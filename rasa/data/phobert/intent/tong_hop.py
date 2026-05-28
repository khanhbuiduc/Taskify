import json
import os
import sys
# Để sử dụng VnCoreNLP, bạn cần cài đặt thư viện py_vncorenlp:
# pip install py_vncorenlp
import py_vncorenlp


def cau_hinh_console_utf8():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8")
            except Exception:
                pass

def tong_hop_intent():
    """
    Tổng hợp các tệp intent từ thư mục intent_phan_loai vào một tệp intent_train.json duy nhất,
    sử dụng VnCoreNLP để tách từ.
    """
    # Khởi tạo VnCoreNLP
    # Thay đổi đường dẫn này nếu thư mục VnCoreNLP của bạn ở vị trí khác
    vncorenlp_path = r"C:\VnCoreNLP"
    if not os.path.exists(vncorenlp_path):
        print(f"Lỗi: Không tìm thấy thư mục VnCoreNLP tại '{vncorenlp_path}'")
        print("Vui lòng tải và giải nén VnCoreNLP vào đường dẫn trên hoặc cập nhật lại biến 'vncorenlp_path'.")
        return
        
    try:
        # Sử dụng RDRSegmenter để có kết quả tách từ tốt nhất
        vncorenlp = py_vncorenlp.VnCoreNLP(save_dir=vncorenlp_path)
    except Exception as e:
        print(f"Lỗi khi khởi tạo VnCoreNLP: {e}")
        print("Hãy chắc chắn rằng bạn đã cài đặt Java và cấu hình VnCoreNLP đúng cách.")
        return

    base_dir = os.path.dirname(os.path.abspath(__file__))
    phan_loai_dir = os.path.join(base_dir, 'intent_examples')
    train_dir = os.path.abspath(os.path.join(base_dir, '..', 'train'))
    tong_hop_file = os.path.join(train_dir, 'intent_train.json')
    
    if not os.path.exists(phan_loai_dir):
        print(f"Thư mục '{phan_loai_dir}' không tồn tại.")
        return

    all_intents = []
    
    print("Bắt đầu xử lý các tệp intent...")
    # Lặp qua tất cả các tệp trong thư mục intent_examples
    for filename in os.listdir(phan_loai_dir):
        if filename.endswith('.json'):
            filepath = os.path.join(phan_loai_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    intent_name = data.get("intent")
                    sentences = data.get("sentences", [])
                    
                    if intent_name and sentences:
                        for sentence in sentences:
                            # Xử lý câu qua VnCoreNLP để tách từ
                            processed_text = vncorenlp.word_segment(sentence)
                            # processed_text là một list các từ, nối chúng lại thành một chuỗi
                            final_text = " ".join(processed_text)
                            
                            all_intents.append({
                                "text": final_text,
                                "intent": intent_name
                            })
            except json.JSONDecodeError:
                print(f"Lỗi: Tệp '{filename}' không phải là tệp JSON hợp lệ.")
            except Exception as e:
                print(f"Đã xảy ra lỗi khi xử lý tệp '{filename}': {e}")

    # Ghi dữ liệu đã tổng hợp vào tệp intent_train.json
    try:
        os.makedirs(os.path.dirname(tong_hop_file), exist_ok=True)
        with open(tong_hop_file, 'w', encoding='utf-8') as f:
            json.dump(all_intents, f, ensure_ascii=False, indent=2)
        print(f"Đã tổng hợp thành công và lưu vào tệp '{tong_hop_file}'")
    except Exception as e:
        print(f"Đã xảy ra lỗi khi ghi tệp '{tong_hop_file}': {e}")

if __name__ == '__main__':
    cau_hinh_console_utf8()
    tong_hop_intent()
