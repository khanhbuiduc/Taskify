import sys, io, os, json, torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

model_dir = r'data\phobert\model\intent_model'
tok = AutoTokenizer.from_pretrained(model_dir)
model = AutoModelForSequenceClassification.from_pretrained(model_dir)
model.eval()

# Segmented strings from intent_train.json
tests = [
    'xin_chào',
    'tạo task họp_team ngày_mai 9h',
    'xoá task học_bài',
    'tóm_tắt_tuần'
]

print('Segmented Test:')
for t in tests:
    inp = tok(t, return_tensors='pt', max_length=256, truncation=True, padding=True)
    with torch.no_grad():
        logits = model(**inp).logits
        idx = torch.argmax(logits).item()
        prob = torch.softmax(logits, dim=-1)[0][idx].item()
    print(f'  [{prob:.1%}] "{t}" => ID:{idx}')
