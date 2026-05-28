# Kiến trúc thư mục `rasa`

Tài liệu này giải thích cấu trúc thư mục [rasa](/C:/Users/HP%20PC/source/repos/Taskify/rasa), các file/thư mục chính đang có trong repo, và vai trò của từng phần trong luồng huấn luyện, runtime, và kiểm thử.

## 1. Bức tranh tổng quát

Thư mục `rasa/` trong repo này không chỉ chứa cấu hình Rasa cơ bản.
Nó gồm 3 lớp lớn:

- lớp cấu hình hội thoại của Rasa
- lớp NLU tùy biến bằng VnCoreNLP và PhoBERT
- lớp action server gọi sang TaskifyAPI để xử lý nghiệp vụ task, note, finance

Ngoài ra còn có các thư mục generated như model, kết quả test, cache, và môi trường Python.

## 2. Cây thư mục rút gọn

```text
rasa/
├─ actions/
│  ├─ common/
│  ├─ finance/
│  ├─ note/
│  ├─ task/
│  ├─ __init__.py
│  ├─ config.py
│  ├─ fallback_actions.py
│  ├─ README.md
│  └─ requirements.txt
├─ custom_components/
│  ├─ __init__.py
│  ├─ phobert_intent.py
│  ├─ phobert_ner.py
│  └─ vncorenlp_tokenizer.py
├─ data/
│  ├─ model/
│  │  ├─ intent_model/
│  │  ├─ ner_model/
│  │  └─ old-version/
│  ├─ nlu/
│  │  ├─ finance.yml
│  │  ├─ note.yml
│  │  ├─ shared.yml
│  │  └─ task.yml
│  ├─ phobert/
│  │  ├─ intent/
│  │  ├─ nlu_gen/
│  │  ├─ train/
│  │  ├─ generate_nlu.py
│  │  ├─ prepare_data.py
│  │  └─ refactor_nlu_v2.py
│  ├─ nlu_legacy.yml.disabled
│  ├─ rules.yml
│  └─ stories.yml
├─ file_query/
│  └─ task.md
├─ models/
├─ plans/
├─ results/
├─ tests/
│  └─ test_stories.yml
├─ .rasa/
├─ venv/
├─ AGENT.md
├─ config.yml
├─ credentials.yml
├─ domain.yml
├─ endpoints.yml
├─ README.md
├─ test_delete.json
├─ test_phobert.py
├─ test_queries.py
├─ test_segmented.py
├─ output.txt
└─ output_test2.txt
```

## 3. Các file gốc ở thư mục `rasa/`

### [config.yml](/C:/Users/HP%20PC/source/repos/Taskify/rasa/config.yml)

Đây là file cấu hình trung tâm của Rasa.

Nó khai báo:

- `pipeline` NLU
- `policies` hội thoại
- `assistant_id`

Trong repo này, `pipeline` không dùng bộ classifier mặc định của Rasa, mà dùng:

- `VnCoreNLPTokenizer`
- `PhobertIntentClassifier`
- `PhobertEntityExtractor`
- `DucklingEntityExtractor`
- `EntitySynonymMapper`
- `FallbackClassifier`

Nói ngắn gọn: file này trả lời câu hỏi "Rasa hiểu câu người dùng bằng cách nào và chọn action tiếp theo ra sao".

### [domain.yml](/C:/Users/HP%20PC/source/repos/Taskify/rasa/domain.yml)

Đây là file mô tả "thế giới" mà bot biết.

Nó định nghĩa:

- `intents`
- `entities`
- `slots`
- `responses`
- `actions`
- `forms`
- `session_config`

Ví dụ trong repo hiện tại:

- intent cho task, note, finance, fallback
- slot cho `task_title`, `priority`, `note_keyword`, `finance_amount`...
- form `create_task_form`
- danh sách custom action như `action_create_task`, `action_search_notes`, `action_summarize_finance`

### [credentials.yml](/C:/Users/HP%20PC/source/repos/Taskify/rasa/credentials.yml)

File này cấu hình channel mà client có thể dùng để nói chuyện với Rasa.

Hiện tại repo bật:

- `rest`

Tức là TaskifyAPI hoặc frontend có thể gọi REST webhook của Rasa.

### [endpoints.yml](/C:/Users/HP%20PC/source/repos/Taskify/rasa/endpoints.yml)

File này khai báo các service bên ngoài mà Rasa cần gọi.

Hiện tại phần chính là:

- `action_endpoint`

trỏ tới action server chạy ở `http://localhost:5055/webhook`.

### [README.md](/C:/Users/HP%20PC/source/repos/Taskify/rasa/README.md)

Tài liệu setup nhanh cho thư mục `rasa/`:

- generate NLU
- prepare data cho PhoBERT
- train Rasa
- chạy server

### [AGENT.md](/C:/Users/HP%20PC/source/repos/Taskify/rasa/AGENT.md)

File hướng dẫn nội bộ cho agent/tooling khi làm việc trong thư mục này.

### File test và output ở root

- [test_phobert.py](/C:/Users/HP%20PC/source/repos/Taskify/rasa/test_phobert.py)
  - test nhanh model PhoBERT intent và NER
- [test_segmented.py](/C:/Users/HP%20PC/source/repos/Taskify/rasa/test_segmented.py)
  - test câu đã qua segmentation
- [test_queries.py](/C:/Users/HP%20PC/source/repos/Taskify/rasa/test_queries.py)
  - test query thủ công
- [test_delete.json](/C:/Users/HP%20PC/source/repos/Taskify/rasa/test_delete.json)
  - dữ liệu thử cho luồng delete
- [output.txt](/C:/Users/HP%20PC/source/repos/Taskify/rasa/output.txt), [output_test2.txt](/C:/Users/HP%20PC/source/repos/Taskify/rasa/output_test2.txt)
  - log hoặc output thử nghiệm lưu tạm

## 4. Thư mục `actions/`

Thư mục [actions](/C:/Users/HP%20PC/source/repos/Taskify/rasa/actions) chứa action server Python.
Đây là nơi bot thực thi nghiệp vụ thật sau khi đã hiểu intent và entity.

Các thành phần chính:

- [actions/config.py](/C:/Users/HP%20PC/source/repos/Taskify/rasa/actions/config.py)
  - cấu hình chung như URL backend, timeout, token, thông tin fallback
- [actions/fallback_actions.py](/C:/Users/HP%20PC/source/repos/Taskify/rasa/actions/fallback_actions.py)
  - xử lý `nlu_fallback`, gọi backend fallback AI
- [actions/README.md](/C:/Users/HP%20PC/source/repos/Taskify/rasa/actions/README.md)
  - hướng dẫn chạy action server
- [actions/requirements.txt](/C:/Users/HP%20PC/source/repos/Taskify/rasa/actions/requirements.txt)
  - dependency Python cho action server

Các thư mục con:

- [actions/task](/C:/Users/HP%20PC/source/repos/Taskify/rasa/actions/task)
  - action cho task như tạo, lọc, xóa, tóm tắt tuần
- [actions/note](/C:/Users/HP%20PC/source/repos/Taskify/rasa/actions/note)
  - action cho note như tạo, tìm, ghim, sửa, xóa
- [actions/finance](/C:/Users/HP%20PC/source/repos/Taskify/rasa/actions/finance)
  - action cho tài chính như tạo khoản chi, lọc, thống kê, quản lý category
- [actions/common](/C:/Users/HP%20PC/source/repos/Taskify/rasa/actions/common)
  - helper dùng chung

Các helper trong `common` gồm:

- `api_utils.py`: gọi TaskifyAPI, xử lý header, sender
- `date_utils.py`: parse ngày giờ tự nhiên
- `delete_match_utils.py`: fuzzy match khi xóa task
- `format_utils.py`: format dữ liệu trả về
- `text_utils.py`: xử lý text, locale, title, reset slot

## 5. Thư mục `custom_components/`

Thư mục [custom_components](/C:/Users/HP%20PC/source/repos/Taskify/rasa/custom_components) chứa các component NLU tự viết để thay thế hoặc mở rộng pipeline mặc định của Rasa.

Các file chính:

- [vncorenlp_tokenizer.py](/C:/Users/HP%20PC/source/repos/Taskify/rasa/custom_components/vncorenlp_tokenizer.py)
  - tokenizer tiếng Việt bằng VnCoreNLP
- [phobert_intent.py](/C:/Users/HP%20PC/source/repos/Taskify/rasa/custom_components/phobert_intent.py)
  - classifier intent bằng PhoBERT fine-tuned
- [phobert_ner.py](/C:/Users/HP%20PC/source/repos/Taskify/rasa/custom_components/phobert_ner.py)
  - extractor entity bằng PhoBERT NER fine-tuned

Đây là lớp rất quan trọng trong kiến trúc hiện tại, vì phần hiểu tiếng Việt chủ yếu nằm ở đây chứ không phải ở classifier mặc định của Rasa.

## 6. Thư mục `data/`

Thư mục [data](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data) chứa cả dữ liệu train hội thoại của Rasa lẫn dữ liệu và script phục vụ PhoBERT.

### `data/rules.yml`

Chứa các luật hội thoại ngắn, chắc chắn, ví dụ:

- `nlu_fallback` thì gọi action fallback
- `create_task` thì vào form
- submit form thì gọi action tương ứng

### `data/stories.yml`

Chứa các story huấn luyện hội thoại nhiều bước.
Nó giúp policy như `TEDPolicy` học được ngữ cảnh hội thoại dài hơn.

### `data/nlu/`

Thư mục [data/nlu](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/nlu) là nơi chứa các file NLU YAML đã tách theo domain:

- [shared.yml](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/nlu/shared.yml)
- [task.yml](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/nlu/task.yml)
- [note.yml](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/nlu/note.yml)
- [finance.yml](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/nlu/finance.yml)

Đây là dữ liệu NLU mà Rasa và script prepare đọc vào.

### `data/nlu_legacy.yml.disabled`

Đây là file NLU cũ, đã bị vô hiệu hóa.
Tên file có hậu tố `.disabled` để không bị tính vào train chính.

### `data/phobert/`

Thư mục [data/phobert](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/phobert) là lớp trung gian để chuẩn bị dữ liệu huấn luyện PhoBERT.

Các file chính:

- [generate_nlu.py](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/phobert/generate_nlu.py)
  - sinh các file `data/nlu/*.yml` từ generator theo domain
- [prepare_data.py](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/phobert/prepare_data.py)
  - đọc `data/nlu/*.yml`, tách entity, segment tiếng Việt, sinh tập train cho PhoBERT
- [refactor_nlu_v2.py](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/phobert/refactor_nlu_v2.py)
  - script cũ, hiện mang tính deprecated/legacy

Các thư mục con:

- [data/phobert/nlu_gen](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/phobert/nlu_gen)
  - nơi viết generator examples theo domain
- [data/phobert/train](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/phobert/train)
  - output dữ liệu train như `intent_train.json`, `ner_train.txt`
- [data/phobert/intent](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/phobert/intent)
  - dữ liệu intent phụ trợ, mapping, ví dụ JSON cũ/phụ

### `data/model/`

Thư mục [data/model](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/model) chứa model PhoBERT runtime mà `custom_components` load trực tiếp.

Các phần đáng chú ý:

- `intent_model/`
  - model classifier intent
- `ner_model/`
  - model NER
- `old-version/`
  - model cũ lưu lại để đối chiếu hoặc rollback
- `main.zip`
  - gói model nén

Điểm quan trọng:

- `data/phobert/train/*` là dữ liệu huấn luyện
- `data/model/*` là model runtime đã fine-tune xong

Đây là hai tầng khác nhau, dễ bị nhầm khi mới đọc repo.

## 7. Thư mục `file_query/`

Thư mục [file_query](/C:/Users/HP%20PC/source/repos/Taskify/rasa/file_query) hiện có [task.md](/C:/Users/HP%20PC/source/repos/Taskify/rasa/file_query/task.md).

Đây là tài liệu nghiệp vụ hoặc ghi chú truy vấn liên quan đến task/chatbox.

## 8. Thư mục `models/`

Thư mục [models](/C:/Users/HP%20PC/source/repos/Taskify/rasa/models) chứa các model package `.tar.gz` do lệnh `rasa train` sinh ra.

Đây là artifact của Rasa runtime, khác với `data/model/`:

- `models/*.tar.gz`
  - package Rasa hoàn chỉnh để `rasa run` nạp
- `data/model/*`
  - model PhoBERT custom được component Python load

Tức là repo đang có cả:

- model đóng gói của Rasa
- model PhoBERT riêng cho custom component

## 9. Thư mục `plans/`

Thư mục [plans](/C:/Users/HP%20PC/source/repos/Taskify/rasa/plans) chứa tài liệu kế hoạch, phân tích, và TODO cho việc phát triển assistant.

Ví dụ:

- `createTask.md`
- `improveCreateTask.md`
- `rasa-intent-slot-plan.md`

Đây không phải dữ liệu train trực tiếp, mà là tài liệu thiết kế/phân tích.

## 10. Thư mục `results/`

Thư mục [results](/C:/Users/HP%20PC/source/repos/Taskify/rasa/results) chứa output đánh giá và test của Rasa.

Ví dụ:

- `intent_report.json`
- `intent_errors.json`
- `intent_confusion_matrix.png`
- `story_report.json`
- `TEDPolicy_report.json`
- `failed_test_stories.yml`

Thư mục này giúp xem chất lượng mô hình sau train/test:

- intent nào nhầm
- entity nào sai
- story nào fail
- confusion matrix ra sao

## 11. Thư mục `tests/`

Thư mục [tests](/C:/Users/HP%20PC/source/repos/Taskify/rasa/tests) chứa test ở cấp Rasa.

Hiện tại có:

- [test_stories.yml](/C:/Users/HP%20PC/source/repos/Taskify/rasa/tests/test_stories.yml)

Đây là file dùng cho `rasa test` hoặc kiểm tra các story quan trọng có còn đúng hành vi không.

## 12. Thư mục generated và môi trường

### `.rasa/`

Thư mục [\.rasa](/C:/Users/HP%20PC/source/repos/Taskify/rasa/.rasa) là cache/runtime data do Rasa sinh ra.
Thường không phải nơi sửa tay.

### `venv/`

Thư mục [venv](/C:/Users/HP%20PC/source/repos/Taskify/rasa/venv) là môi trường Python cục bộ.
Nó chứa:

- interpreter
- package đã cài
- script executable

Đây là môi trường chạy, không phải source code nghiệp vụ.

### `__pycache__/`

Thư mục cache bytecode Python.
Không phải nơi cần chỉnh sửa.

## 13. Nên bắt đầu đọc từ đâu

Nếu muốn hiểu nhanh kiến trúc `rasa/`, nên đọc theo thứ tự:

1. [README.md](/C:/Users/HP%20PC/source/repos/Taskify/rasa/README.md)
2. [config.yml](/C:/Users/HP%20PC/source/repos/Taskify/rasa/config.yml)
3. [domain.yml](/C:/Users/HP%20PC/source/repos/Taskify/rasa/domain.yml)
4. [data/rules.yml](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/rules.yml) và [data/stories.yml](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/stories.yml)
5. [custom_components](/C:/Users/HP%20PC/source/repos/Taskify/rasa/custom_components)
6. [actions](/C:/Users/HP%20PC/source/repos/Taskify/rasa/actions)
7. [data/phobert](/C:/Users/HP%20PC/source/repos/Taskify/rasa/data/phobert)

Theo thứ tự này, người đọc sẽ hiểu lần lượt:

- bot được cấu hình như thế nào
- bot biết những intent/entity gì
- bot học hội thoại ra sao
- bot hiểu tiếng Việt bằng component nào
- bot gọi backend bằng action nào
- dữ liệu PhoBERT được sinh và chuẩn bị như thế nào

## 14. Tóm tắt ngắn

Có thể nhìn thư mục `rasa/` như sau:

- `config.yml`, `domain.yml`, `credentials.yml`, `endpoints.yml` là lớp cấu hình gốc của Rasa
- `data/` là lớp dữ liệu train và dữ liệu chuẩn bị cho PhoBERT
- `custom_components/` là lớp NLU tùy biến
- `actions/` là lớp nghiệp vụ gọi API thật
- `models/`, `results/`, `.rasa/` là lớp output/runtime/generated
- `tests/` và các file `test_*.py` là lớp kiểm thử
- `plans/` và `file_query/` là lớp tài liệu hỗ trợ phân tích và thiết kế
