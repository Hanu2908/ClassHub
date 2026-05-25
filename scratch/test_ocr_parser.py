import re

# Mock subjects currently in the user's table (default SEM1_COMMON)
default_subjects = [
    {"id": "1", "name": "Engineering Mathematics-I", "credits": 4},
    {"id": "2", "name": "Engineering Physics / Engineering Chemistry", "credits": 4},
    {"id": "3", "name": "Communication Skills / Universal Human Values", "credits": 2},
    {"id": "4", "name": "Computational Thinking and Programming", "credits": 2},
    {"id": "5", "name": "Basic Electrical & Electronics Engineering", "credits": 2},
    {"id": "6", "name": "Engineering Physics / Chemistry Lab", "credits": 1},
    {"id": "7", "name": "Language Lab / Universal Human Values Lab", "credits": 1},
    {"id": "8", "name": "C Programming Lab", "credits": 1},
    {"id": "9", "name": "Basic EE Lab / Manufacturing Practice Workshop", "credits": 1},
    {"id": "10", "name": "Computer Aided Engineering Graphics", "credits": 1.5},
    {"id": "11", "name": "SODECA", "credits": 0.5}
]

# Read OCR output
with open("scratch/page_0_ocr.txt", "r", encoding="utf-8") as f:
    ocr_lines = f.read().split("\n")

def clean_text(text):
    return re.sub(r'[^A-Z0-9\-+\s]', ' ', text.upper())

def extract_numbers(line):
    # Extract isolated integers from the line
    # (avoiding alphanumeric like course codes MAUL101, page numbers, etc.)
    words = line.split()
    nums = []
    for w in words:
        # Check if word is a pure integer
        if re.match(r'^\d+$', w):
            val = int(w)
            if 0 <= val <= 100:
                nums.append(val)
    return nums

def get_total_marks(line):
    # Try to find the total marks from the list of numbers on the line
    nums = extract_numbers(line)
    if not nums:
        return None
    
    # Standard format: [ISE, SEE, TOTAL]
    if len(nums) >= 3:
        ise, see, total = nums[0], nums[1], nums[2]
        # Sum validation
        if ise + see == total:
            return total
        # Typo correction: if ise + see is valid, and total is misread (like 7 instead of 71)
        if 40 <= ise + see <= 100:
            return ise + see
        if 30 <= total <= 100:
            return total
        return max(total, ise + see)
    elif len(nums) == 2:
        # [x, total] or [total, total]
        x, y = nums[0], nums[1]
        if y >= 30:
            return y
        return x
    elif len(nums) == 1:
        return nums[0]
    return None

def match_subject(line_text, sub_name):
    clean_line = clean_text(line_text)
    clean_sub = sub_name.upper()
    
    # Split slash options
    options = [opt.strip() for opt in clean_sub.split('/')]
    
    # Define exact/fuzzy overrides for specific subjects to be bulletproof
    if "SODECA" in clean_sub and "SODECA" in clean_line:
        return True, "SODECA"
    
    # Special override for thinking / programming
    if "THINKING" in clean_sub and "THINKING" in clean_line:
        return True, "Computational Thinking and Programming"
        
    # Check alternate electives if they aren't matching
    # If table has Basic Electrical and marksheet has Basic Mechanical
    if "BASIC ELECTRICAL" in clean_sub and "MECHANICAL" in clean_line:
        return True, "Basic Mechanical Engineering"
    if "BASIC EE LAB" in clean_sub and ("MANUFACTURING" in clean_line or "PRACTICE" in clean_line):
        return True, "Manufacturing Practice Workshop"
    
    for option in options:
        # Skip empty or very short options
        if len(option) < 3:
            continue
            
        # Get keywords
        keywords = [w for w in re.split(r'\s+', option) 
                    if len(w) > 2 and w not in ['AND', 'THE', 'LAB', 'PRACTICAL', 'THEORY', 'ENGINEERING', 'BASIC', 'SKILLS', 'VALUES']]
        
        if not keywords:
            continue
            
        match_count = sum(1 for w in keywords if w in clean_line)
        required = 1 if len(keywords) == 1 else min(2, len(keywords))
        
        if match_count >= required:
            # Lab vs Theory check
            option_is_lab = any(x in option for x in ['LAB', 'WORKSHOP', 'PRACTICE', 'GRAPHICS'])
            line_is_lab = any(x in clean_line for x in ['LAB', 'WORKSHOP', 'PRACTICE', 'WORKS', 'UP', 'MEUP', 'CSUP', 'CHUP', 'HSUP'])
            
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

print("--- Testing Marksheet Parser ---")
matched_count = 0
for line in ocr_lines:
    if not line.strip():
        continue
    
    clean_l = clean_text(line)
    
    # Try to match with each default subject
    for sub in default_subjects:
        matched, refined_name = match_subject(line, sub["name"])
        if matched:
            marks = get_total_marks(line)
            if marks is not None:
                print(f"MATCHED: '{sub['name']}' -> '{refined_name}' | Marks: {marks} (from line: {line.strip()})")
                matched_count += 1
                break

print(f"\nTotal matched subjects: {matched_count} / {len(default_subjects)}")
