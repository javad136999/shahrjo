from __future__ import annotations
import json, os, re, sys
from pathlib import Path
from openai import OpenAI

ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT/'apps/web/src/lib/tourism.ts', ROOT/'apps/web/src/lib/tourism-next20.ts', ROOT/'apps/web/src/lib/tourism-batch2.ts', ROOT/'apps/web/src/lib/tourism-batch3.ts']

def extract():
    rows=[]
    for path in FILES:
        text=path.read_text(encoding='utf-8')
        city=''
        for line_no,line in enumerate(text.splitlines(),1):
            cm=re.match(r"\s{2}['\"]?([\w-]+)['\"]?\s*:\s*\[",line)
            if cm: city=cm.group(1)
            im=re.search(r"id:\s*['\"]([^'\"]+)['\"].*?name:\s*['\"]([^'\"]+)['\"].*?category:\s*['\"]([^'\"]+)['\"]",line)
            if not im: continue
            quote='"' if 'description: "' in line else "'"
            marker=f'description: {quote}'
            start=line.find(marker)
            if start<0: continue
            start += len(marker); end=line.find(quote,start)
            if end<0: continue
            rows.append({'id':im.group(1),'name':im.group(2),'category':im.group(3),'current':line[start:end],'file':str(path),'line_no':line_no})
    return rows

def rewrite(rows, out):
    client=OpenAI()
    payload=[{k:r[k] for k in ('id','name','category','current')} for r in rows]
    prompt='''برای جاذبه‌های گردشگری زیر، توضیح فارسیِ کامل و خوش‌خوان بنویس؛ سبک متن باید شبیه توضیح مفصل جاذبه‌های کاشان در همین پروژه باشد، نه یک جملهٔ تبلیغاتی کوتاه. برای هر مورد ۲ تا ۴ جمله و حدود ۵۰ تا ۹۰ کلمه بنویس. فقط بر پایهٔ نام و متن فعلی بنویس؛ آمار، تاریخ دقیق، شمارهٔ ثبت، فاصله، یونسکو یا ادعای قطعی جدید اضافه نکن مگر اینکه در متن فعلی آمده باشد. اگر جاذبه در پیرامون شهر است، این موضوع را با عبارت‌هایی مثل «در پیرامون» یا «در مسیر» روشن کن. متن باید مناسب صفحهٔ راهنمای سفر، بی‌طرف، کاربردی و بدون Markdown باشد. نام جاذبه را تکرار نکن و از عبارت‌های کلیشه‌ای و ادعاهای ساختگی پرهیز کن. خروجی فقط JSON مطابق schema باشد و برای هر id دقیقاً یک description برگردان.'''
    schema={'type':'object','properties':{'items':{'type':'array','items':{'type':'object','properties':{'id':{'type':'string'},'description':{'type':'string'}},'required':['id','description'],'additionalProperties':False}}},'required':['items'],'additionalProperties':False}
    resp=client.chat.completions.create(model='gpt-6-luna',messages=[{'role':'system','content':prompt},{'role':'user','content':json.dumps(payload,ensure_ascii=False)}],response_format={'type':'json_schema','json_schema':{'name':'tourism_descriptions','strict':True,'schema':schema}},max_completion_tokens=50000)
    data=json.loads(resp.choices[0].message.content)
    by={x['id']:x['description'].strip() for x in data['items']}
    if set(by)!=set(r['id'] for r in rows): raise RuntimeError('model returned mismatched ids')
    out.write_text(json.dumps(by,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('wrote',len(by),'descriptions to',out)

if __name__=='__main__':
    rows=extract(); print('found',len(rows),'spots')
    limit=int(sys.argv[1]) if len(sys.argv)>1 else len(rows)
    out=Path(sys.argv[2]) if len(sys.argv)>2 else ROOT/'tmp-tourism-descriptions.json'
    rewrite(rows[:limit],out)
