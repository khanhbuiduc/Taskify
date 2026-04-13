import yaml
import json
import re
import os

try:
    from vncorenlp import VnCoreNLP
except ImportError:
    print("Vui lòng cài đặt thư viện by running: pip install vncorenlp")
    import sys
    sys.exit(1)

def extract_entities(example_text):
    """
    Parse chuỗi văn bản Rasa (có chứa thực thể) thành text sạch và danh sách thực thể.
    VD: "Tôi muốn [Hà Nội](location) vào [sáng mai](time)"
    => "Tôi muốn Hà Nội vào sáng mai", [{"start": 9, "end": 15, "entity": "location"}, ...]
    """
    entities = []
    clean_text = ""
    last_end = 0
    
    for match in re.finditer(r'\[(.*?)\]\((.*?)\)', example_text):
        start_match = match.start()
        end_match = match.end()
        value = match.group(1)
        entity_name = match.group(2)
        
        # Lấy phần văn bản trước entity
        clean_text += example_text[last_end:start_match]
        
        ent_start = len(clean_text)
        clean_text += value
        ent_end = len(clean_text)
        
        entities.append({
            "start": ent_start,
            "end": ent_end,
            "entity": entity_name,
            "value": value
        })
        
        last_end = end_match
        
    clean_text += example_text[last_end:]
    # Thay thế các khoảng trắng liên tiếp bằng 1 khoảng trắng
    clean_text = re.sub(r'\s+', ' ', clean_text).strip()
    return clean_text, entities

def align_tokens_to_entities(words, clean_text, entities):
    """
    Gắn nhãn BIO cho các từ (word) dựa vào vị trí thực thể.
    """
    tokens = []
    tags = []
    
    current_offset = 0
    for word in words:
        # VnCoreNLP đổi khoảng trắng trong từ ghép thành '_'
        word_str = word.replace('_', ' ')
        
        # Tìm vị trí bắt đầu thực tế trong văn bản gốc
        start_pos = clean_text.lower().find(word_str.lower(), current_offset)
        
        if start_pos != -1:
            end_pos = start_pos + len(word_str)
            current_offset = end_pos
        else:
            # Fallback nếu tìm không thấy chính xác do các lỗi chuẩn hoá đặc biệt
            start_pos = current_offset
            end_pos = start_pos + len(word_str)
        
        tag = "O"
        for ent in entities:
            ent_start = ent["start"]
            ent_end = ent["end"]
            
            # Kiểm tra xem từ hiện tại có nằm bên trong vùng của thực thể không
            # Lấy nửa khoảng [start_pos, end_pos) để check giao nhau
            if (start_pos >= ent_start and start_pos < ent_end) or \
               (end_pos > ent_start and end_pos <= ent_end) or \
               (start_pos <= ent_start and end_pos >= ent_end):
                
                # Quyết định B- hay I-
                # Nếu đây là từ đầu tiên của thực thể này
                if len(tags) == 0 or not tags[-1].endswith(ent['entity']):
                    tag = f"B-{ent['entity']}"
                else:
                    tag = f"I-{ent['entity']}"
                break
                
        tokens.append(word)
        tags.append(tag)
        
    return tokens, tags


def process_nlu_yaml(file_path, rdrsegmenter):
    """
    Đọc file `nlu.yml` của Rasa, tiến hành xử lý bằng thư viện VnCoreNLP.
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    intent_data = []
    ner_data = []
    
    for item in data.get('nlu', []):
        if 'intent' in item and 'examples' in item:
            intent_name = item['intent']
            examples_text = item['examples']
            
            # Tách các ví dụ theo dòng
            examples = [line.strip().lstrip('- ').strip() for line in examples_text.strip().split('\n')]
            
            for example in examples:
                if not example:
                    continue
                
                # 1. Trích xuất văn bản làm sạch và toạ độ offsets thực thể
                clean_text, entities = extract_entities(example)
                
                # Lưu lại cho train intent
                # Đối với intent PhoBERT, bạn có thể truyền văn bản đã phân đoạn (word segmented)
                sentences = rdrsegmenter.tokenize(clean_text)
                # Ghép tất cả các câu/từ thành một chuỗi token có dấu '_'
                words = []
                for sentence in sentences:
                    words.extend(sentence)
                
                segmented_text = " ".join(words)
                
                intent_data.append({
                    "text": segmented_text,  # Dùng text tách từ cho PhoBERT intent classification
                    "intent": intent_name
                })
                
                # 2. Xử lý BIO tag cho NER
                if words:
                    tokens_list, tags_list = align_tokens_to_entities(words, clean_text, entities)
                    ner_data.append((tokens_list, tags_list))
    
    return intent_data, ner_data

def save_intent_json(data, output_path):
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✅ Đã lưu {len(data)} ví dụ Intent tại {output_path}")

def save_ner_txt(data, output_path):
    with open(output_path, 'w', encoding='utf-8') as f:
        for tokens, tags in data:
            for token, tag in zip(tokens, tags):
                f.write(f"{token} {tag}\n")
            f.write("\n") # Dấu phân tách cuối câu
    print(f"✅ Đã lưu {len(data)} ví dụ NER tại {output_path}")

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    nlu_path = os.path.join(current_dir, '..', 'nlu.yml')
    
    intent_output = os.path.join(current_dir, 'intent_train.json')
    ner_output = os.path.join(current_dir, 'ner_train.txt')
    
    # ------------------------------------------------------------------
    #  KHỞI TẠO VNCORENLP DỰA THEO ĐƯỜNG DẪN CỦA BẠN
    # ------------------------------------------------------------------
    # Sửa "HP PC" thành tên thư mục chuẩn DOS "HPPC~1" để tránh lỗi Java không chịu được khoảng trắng (space)
    jar_path = r"C:\Users\HPPC~1\VnCoreNLP\VnCoreNLP-1.2.jar"
    if not os.path.exists(jar_path):
        print(f"❌ Không tìm thấy file {jar_path}.")
        import sys; sys.exit(1)
        
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    print(f"Đang khởi tạo VnCoreNLP từ {jar_path} ... (có thể mất tới vài phút trong lần chạy đầu)")
    rdrsegmenter = VnCoreNLP(jar_path, annotators="wseg", max_heap_size='-Xmx2g', quiet=False)
    
    if os.path.exists(nlu_path):
        print(f"Bắt đầu xử lý {nlu_path} ...")
        intent_data, ner_data = process_nlu_yaml(nlu_path, rdrsegmenter)
        
        save_intent_json(intent_data, intent_output)
        save_ner_txt(ner_data, ner_output)
        print("🎉 XONG! Dữ liệu đã sẵn sàng cho PhoBERT.")
    else:
        print(f"❌ Không tìm thấy file nlu.yml tại {nlu_path}")
