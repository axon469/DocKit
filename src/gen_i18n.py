import json,re
d={}
for f in ['bn1.txt','bn2.txt','bn3.txt']:
    for ln in open(f,encoding='utf8'):
        ln=ln.rstrip('\n')
        if ' ¦ ' not in ln: continue
        en,bn=ln.split(' ¦ ',1)
        en=en.strip().replace('\\\\','\\'); bn=bn.strip().replace('\\\\','\\')
        d[en]=bn
rules=open('bn_rules.js',encoding='utf8').read()
out='const BN = '+json.dumps(d,ensure_ascii=False,indent=0)+';\n'+rules
open('i18n-bn.js','w',encoding='utf8').write(out)
print(len(d),'entries')
