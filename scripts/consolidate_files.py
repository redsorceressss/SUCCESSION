import os
import shutil

repo_root = r"C:\Users\SREENIDHI D V\OneDrive\Desktop\FOLDERS\INTERNSHIP, LEETCODE, CODING, PLACEMENT ETC\INTERNSHIP STUFF\HACKATHONS\TECH4BHARAT\succession"
brain_root = r"C:\Users\SREENIDHI D V\.gemini\antigravity\brain\c70b0cea-b55e-407b-9fcb-cc3bf8882eee"
parent_dir = r"C:\Users\SREENIDHI D V\OneDrive\Desktop\FOLDERS\INTERNSHIP, LEETCODE, CODING, PLACEMENT ETC\INTERNSHIP STUFF\HACKATHONS\TECH4BHARAT"

copied = []

# 1. External submission docx
sub_src = os.path.join(parent_dir, "submissionideatemplate.docx")
sub_dst = os.path.join(repo_root, "docs", "hackathon_submissions", "submissionideatemplate.docx")
if os.path.exists(sub_src):
    shutil.copy2(sub_src, sub_dst)
    copied.append((sub_src, sub_dst, os.path.getsize(sub_dst)))

# 2. Brain scratch scripts -> archive/investigation_scripts
scratch_dir = os.path.join(brain_root, "scratch")
inv_dir = os.path.join(repo_root, "archive", "investigation_scripts")
if os.path.exists(scratch_dir):
    for f in os.listdir(scratch_dir):
        s = os.path.join(scratch_dir, f)
        d = os.path.join(inv_dir, f)
        if os.path.isfile(s):
            shutil.copy2(s, d)
            copied.append((s, d, os.path.getsize(d)))

# 3. Brain shortlist markdown artifacts -> brain/planning and brain/archived_notes
v2_src = os.path.join(brain_root, "dataset_shortlist_v2.md")
v2_dst = os.path.join(repo_root, "brain", "archived_notes", "dataset_shortlist_v2.md")
if os.path.exists(v2_src):
    shutil.copy2(v2_src, v2_dst)
    copied.append((v2_src, v2_dst, os.path.getsize(v2_dst)))

v3_src = os.path.join(brain_root, "dataset_shortlist_v3.md")
v3_dst = os.path.join(repo_root, "brain", "planning", "dataset_shortlist_v3.md")
v3_docs = os.path.join(repo_root, "docs", "ai_ml_documentation", "dataset_shortlist_v3.md")
if os.path.exists(v3_src):
    shutil.copy2(v3_src, v3_dst)
    shutil.copy2(v3_src, v3_docs)
    copied.append((v3_src, v3_dst, os.path.getsize(v3_dst)))
    copied.append((v3_src, v3_docs, os.path.getsize(v3_docs)))

# 4. User uploaded PDFs from brain -> docs/research_and_references
user_up_dir = os.path.join(brain_root, ".user_uploaded")
if os.path.exists(user_up_dir):
    for f in os.listdir(user_up_dir):
        s = os.path.join(user_up_dir, f)
        d = os.path.join(repo_root, "docs", "research_and_references", f)
        if os.path.isfile(s):
            shutil.copy2(s, d)
            copied.append((s, d, os.path.getsize(d)))

# 5. Categorize docs/ files into specialized folders
doc_mappings = [
    ("architecture.md", "docs/architecture/architecture.md"),
    ("conservation.md", "docs/architecture/conservation.md"),
    ("api_contract.md", "docs/api_documentation/api_contract.md"),
    ("database.md", "docs/database_documentation/database.md"),
    ("database.md", "database/documentation/database.md"),
    ("setup.md", "docs/technical_documentation/setup.md"),
    ("limits.md", "docs/technical_documentation/limits.md"),
    ("dispute_workflow.md", "docs/technical_documentation/dispute_workflow.md"),
    ("ai_workflow.md", "docs/technical_documentation/ai_workflow.md"),
    ("TEST_GUIDE.md", "docs/testing_documentation/TEST_GUIDE.md"),
    ("ocr_testing_guide.md", "docs/testing_documentation/ocr_testing_guide.md"),
    ("demo.md", "docs/testing_documentation/demo.md"),
    ("evaluation_report.md", "docs/ai_ml_documentation/evaluation_report.md"),
    ("SUCCESSION Every Gram, Witnessed.pdf", "docs/research_and_references/SUCCESSION Every Gram, Witnessed.pdf"),
    ("SUCCESSION_Backend_AI_Playbook.pdf", "docs/research_and_references/SUCCESSION_Backend_AI_Playbook.pdf"),
    ("TECH4BHARAT_DEVELOPMENT_HANDBOOK.pdf", "docs/research_and_references/TECH4BHARAT_DEVELOPMENT_HANDBOOK.pdf"),
]

for src_name, dst_rel in doc_mappings:
    s = os.path.join(repo_root, "docs", src_name)
    d = os.path.join(repo_root, dst_rel.replace("/", os.sep))
    if os.path.exists(s):
        shutil.copy2(s, d)
        copied.append((s, d, os.path.getsize(d)))

print(f"Successfully consolidated {len(copied)} files!")
for src, dst, sz in copied[:10]:
    print(f"Copied: {os.path.basename(src)} -> {dst} ({sz} bytes)")
