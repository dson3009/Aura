import os
import re

# Match conflict blocks safely, even if one of the blocks is empty (no newline before =======)
conflict_re = re.compile(r'<<<<<<<[^\r\n]*\r?\n([\s\S]*?)(?:\r?\n)?=======\r?\n([\s\S]*?)\r?\n>>>>>>>[^\r\n]*')

def resolve_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if '<<<<<<<' in content and '=======' in content and '>>>>>>>' in content:
        print(f"Resolving conflicts in: {file_path}")
        new_content = conflict_re.sub(r'\2', content)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

def main():
    src_dir = './src'
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith(('.ts', '.tsx', '.js', '.jsx', '.css')):
                file_path = os.path.join(root, file)
                resolve_file(file_path)

if __name__ == '__main__':
    main()
