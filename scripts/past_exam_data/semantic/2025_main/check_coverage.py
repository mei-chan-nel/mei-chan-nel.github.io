import runpy,fitz,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
b=runpy.run_path(str(HERE/'build.py'));I=b['I'];doc=b['DOC'];cover=b['COVER']
manual={1:[(70,130),(379,465)],2:[(159,243)],3:[(190,381)],4:[(130,225),(360,460)],6:[(76,171)],7:[(460,652)],8:[(298,450),(472,630)],10:[(76,440)],11:[(139,203)],12:[(154,365),(470,495),(531,555)],13:[(235,475),(499,624)],14:[(76,145)],16:[(177,474)],17:[(199,283),(314,541)],18:[(159,303)],19:[(323,391),(465,560)],20:[(296,475)],21:[(419,514),(534,597)],22:[(179,355),(499,545)],23:[(183,250),(270,445)],24:[(79,395),(419,590)],25:[(242,381)],26:[(188,420),(440,643)],27:[(299,486)],28:[(76,634)],29:[(532,654)],30:[(70,343),(366,623)],32:[(77,370),(392,592)]}
missing=[]
for i,p in enumerate(doc,1):
 bands=[(v[0],v[1]) for v in cover.get(i,[])]+manual.get(i,[])
 for l in I.page_data(doc,p):
  if not any(a<=l['bbox'].y0<=z for a,z in bands):missing.append((i,round(l['bbox'].y0,1),l['text']))
print('Source lines not assigned to prose or a native table/program/choices/figure:',missing)
assert not missing
