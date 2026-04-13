import sys, io, os, json, torch
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from transformers import AutoModelForSequenceClassification, AutoModelForTokenClassification, AutoTokenizer

# === TEST INTENT ===
intent_dir = r'data\phobert\model\intent_model'
tok_i = AutoTokenizer.from_pretrained(intent_dir)
model_i = AutoModelForSequenceClassification.from_pretrained(intent_dir)
model_i.eval()
with open(os.path.join(intent_dir, 'intent_labels.json'), encoding='utf-8-sig') as f:
    id2label_i = json.load(f)

tests_i = ['xin_chào', 'tạo task họp team ngày_mai 9h', 'xoá task học bài', 'tóm_tắt tuần']
print('=== INTENT ===')
for t in tests_i:
    inp = tok_i(t, return_tensors='pt', max_length=256, truncation=True, padding=True)
    with torch.no_grad():
        probs = torch.softmax(model_i(**inp).logits, dim=-1)[0]
    idx = torch.argmax(probs).item()
    print(f'  [{probs[idx]:.1%}] "{t}" => {id2label_i[str(idx)]}')

# === TEST NER ===
ner_dir = r'data\phobert\model\ner_model'
tok_n = AutoTokenizer.from_pretrained(ner_dir)
model_n = AutoModelForTokenClassification.from_pretrained(ner_dir)
model_n.eval()
id2label_n = {int(k): v for k, v in model_n.config.id2label.items()}

# Align thủ công: tokenize từng từ riêng để biết số token mỗi từ sinh ra
print('\n=== NER ===')
tests_n = [
    ('tạo task họp team ngày_mai 9h', ['tạo', 'task', 'họp', 'team', 'ngày_mai', '9h']),
    ('thêm nhiệm_vụ viết báo_cáo ưu_tiên cao', ['thêm', 'nhiệm_vụ', 'viết', 'báo_cáo', 'ưu_tiên', 'cao']),
]
for text, words in tests_n:
    # Build word_id map thủ công
    word_ids_manual = []
    all_token_ids = [tok_n.bos_token_id]  # [CLS]
    word_ids_manual.append(None)
    for w_idx, word in enumerate(words):
        toks = tok_n.encode(word, add_special_tokens=False)
        for t in toks:
            all_token_ids.append(t)
            word_ids_manual.append(w_idx)
    all_token_ids.append(tok_n.eos_token_id)  # [SEP]
    word_ids_manual.append(None)

    input_tensor = torch.tensor([all_token_ids])
    with torch.no_grad():
        logits = model_n(input_ids=input_tensor).logits[0]
        probs = torch.softmax(logits, dim=-1)
        label_ids = torch.argmax(probs, dim=-1).tolist()
        top_p = probs.max(dim=-1).values.tolist()

    print(f'  Input: "{text}"')
    seen = set()
    for i, wid in enumerate(word_ids_manual):
        if wid is None or wid in seen: continue
        seen.add(wid)
        lbl = id2label_n.get(label_ids[i], 'O')
        if lbl != 'O':
            print(f'    [{top_p[i]:.1%}] "{words[wid]}" => {lbl}')
