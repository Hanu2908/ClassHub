import re

subjects = [
    {"id": "1", "name": "Engineering Mathematics-II", "credits": 4},
    {"id": "2", "name": "Engineering Physics / Engineering Chemistry", "credits": 4},
    {"id": "3", "name": "Communication Skills / Universal Human Values", "credits": 2},
    {"id": "4", "name": "Innovation & Entrepreneurship", "credits": 1},
    {"id": "5", "name": "Problem Solving using Object Oriented Paradigm", "credits": 2},
    {"id": "6", "name": "Basic Electrical & Electronics Engineering / Basic Mechanical Engineering", "credits": 2},
    {"id": "7", "name": "Engineering Physics Lab / Engineering Chemistry Lab", "credits": 1},
    {"id": "8", "name": "Language Lab / Universal Human Values Lab", "credits": 1},
    {"id": "9", "name": "Object Oriented Programming Lab", "credits": 1},
    {"id": "10", "name": "Basic Electrical & Electronics Engineering Lab / Manufacturing Practice Workshop", "credits": 1},
    {"id": "11", "name": "Computer Aided Engineering Graphics / Computer Aided Machine Drawing", "credits": 1.5},
    {"id": "12", "name": "Environmental Sciences / Constitution of India", "credits": 0},
    {"id": "13", "name": "Social Outreach, Discipline and Extra-Curricular Activities (SODECA)", "credits": 0.5}
]

# Read OCR output
with open("scratch/page_0_sem2_ocr.txt", "r", encoding="utf-8") as f:
    ocr_lines = f.read().split("\n")

def clean_text(text):
    return re.sub(r'[^A-Z0-9\-+\s]', ' ', text.upper())

def extract_numbers_resilient(str_val):
    words = str_val.split()
    nums = []
    for w in words:
        match = re.search(r'\d+', w)
        if match:
            val = int(match.group())
            if 0 <= val <= 100:
                nums.append(val)
    return nums

def get_marks_from_line_r2l(line):
    nums = extract_numbers_resilient(line)
    if not nums:
        return None
        
    rev = list(reversed(nums))
    if len(rev) >= 3:
        total = rev[0]
        see = rev[1]
        ise = rev[2]
        
        if ise + see == total:
            return total
        if 30 <= total <= 100:
            return total
        if 30 <= ise + see <= 100:
            return ise + see
            
    return nums[-1] if nums else None

def match_subject(line_text, sub_name):
    clean_line = clean_text(line_text)
    clean_sub = sub_name.upper()
    
    # Specific override for SODECA
    if "SODECA" in clean_sub and "SODECA" in clean_line:
        return True, "Social Outreach, Discipline and Extra-Curricular Activities (SODECA)"
        
    # Specific override for THINKING
    if "THINKING" in clean_sub and "THINKING" in clean_line:
        return True, "Computational Thinking and Programming"
        
    # Split by /
    options = [opt.strip() for opt in clean_sub.split('/')]
    
    for option in options:
        if len(option) < 3:
            continue
            
        # Strip dashes and special chars to split MATHEMATICS-II into [MATHEMATICS, II]
        clean_option = re.sub(r'[^A-Z0-9\s]', ' ', option)
            
        # Keep short keywords (length >= 2)
        keywords = [w for w in re.split(r'\s+', clean_option) 
                    if len(w) >= 2 and w not in ['AND', 'THE', 'LAB', 'PRACTICAL', 'THEORY', 'ENGINEERING', 'BASIC', 'SKILLS', 'VALUES']]
        
        if not keywords:
            continue
            
        match_count = sum(1 for w in keywords if w in clean_line)
        required = 1 if len(keywords) == 1 else min(2, len(keywords))
        
        if match_count >= required:
            # Lab vs Theory check
            option_is_lab = any(x in option for x in ['LAB', 'WORKSHOP', 'PRACTICE', 'GRAPHICS', 'DRAWING'])
            line_is_lab = any(x in clean_line for x in ['LAB', 'WORKSHOP', 'PRACTICE', 'WORKS', 'UP', 'MEUP', 'CSUP', 'CHUP', 'HSUP', 'DRAWING'])
            
            if option_is_lab != line_is_lab:
                continue
                
            # Determine refined name
            refined_name = option
            if "CHEMISTRY" in option and "LAB" in option:
                refined_name = "Engineering Chemistry Lab"
            elif "PHYSICS" in option and "LAB" in option:
                refined_name = "Engineering Physics Lab"
            elif "CHEMISTRY" in option:
                refined_name = "Engineering Chemistry"
            elif "PHYSICS" in option:
                refined_name = "Engineering Physics"
            elif "UNIVERSAL HUMAN VALUES" in option and "LAB" in option:
                refined_name = "Universal Human Values Lab"
            elif "LANGUAGE" in option:
                refined_name = "Language Lab"
            elif "VALUES" in option:
                refined_name = "Universal Human Values"
            elif "COMMUNICATION" in option:
                refined_name = "Communication Skills"
            elif "MANUFACTURING" in option or "PRACTICE" in option:
                refined_name = "Manufacturing Practice Workshop"
                
            return True, refined_name
            
    return False, sub_name

print("--- Testing SEM 2 Marksheet Parser ---")
matched_count = 0
matches_found = []

for line in ocr_lines:
    if not line.strip():
        continue
        
    for sub in subjects:
        matched, refined_name = match_subject(line, sub["name"])
        if matched and sub["id"] not in [m["id"] for m in matches_found]:
            marks = get_marks_from_line_r2l(line)
            if marks is not None:
                matches_found.append({"id": sub["id"], "name": refined_name, "marks": marks, "line": line.strip()})
                matched_count += 1
                break

for m in sorted(matches_found, key=lambda x: int(x["id"])):
    print(f"MATCHED: Sub ID {m['id']} | '{m['name']}' | Marks: {m['marks']} | Line: '{m['line']}'")

print(f"\nTotal matched subjects: {matched_count} / {len(subjects)}")
