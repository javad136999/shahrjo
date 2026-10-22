from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
files=[ROOT/'apps/web/src/lib/tourism.ts',ROOT/'apps/web/src/lib/tourism-next20.ts',ROOT/'apps/web/src/lib/tourism-batch2.ts',ROOT/'apps/web/src/lib/tourism-batch3.ts']
by=json.loads(Path('/tmp/tourism-descriptions.json').read_text(encoding='utf8'))
changed=0
for path in files:
 lines=path.read_text(encoding='utf8').splitlines()
 out=[]
 for line in lines:
  im=re.search(r'id:\s*[\'\"]([^\'\"]+)[\'\"]',line)
  if not im or im.group(1) not in by or 'description:' not in line:
   out.append(line); continue
  q='"' if 'description: "' in line else "'"
  marker=f'description: {q}'; start=line.find(marker)+len(marker); end=line.find(q,start)
  if start < len(marker) or end<0:
   out.append(line); continue
  value=by[im.group(1)].replace('\\','\\\\').replace(q,'\\'+q)
  out.append(line[:start]+value+line[end:]); changed+=1
 path.write_text('\n'.join(out)+'\n',encoding='utf8')
print('updated',changed,'descriptions')
if changed != len(by): raise SystemExit(f'expected {len(by)} updates, got {changed}')
