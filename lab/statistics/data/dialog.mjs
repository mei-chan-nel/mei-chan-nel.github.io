import {esc} from '../shared/ui.mjs?v=20261026-final-upgrade';
import {validateInput,typeDescription} from './schema.mjs?v=20261026-final-upgrade';
import {downloadTemplate,readFile} from './files.mjs?v=20261026-final-upgrade';
export function openDataDialog({schema,apply,opener}){
  const dialog=document.createElement('dialog');dialog.className='data-import-dialog';dialog.setAttribute('aria-labelledby','data-import-title');
  dialog.innerHTML=`<header><h2 id="data-import-title">自分のデータで試す</h2><button id="data-import-close" type="button" aria-label="閉じる">閉じる</button></header><div class="data-import-body"><p class="data-privacy">読み込んだデータは、お使いの端末内で処理されます。外部のサーバーに送信されることはありません。</p><section><h3>1. ひな形をダウンロード</h3><p>入力例を自分のデータに置き換えます。「#表題」の右隣に表題、「#列名」の右側に表示用の列名を入力できます。分析用の列名の行はそのまま残してください。</p><div class="actions"><button data-template="csv" type="button">CSVのひな形</button><button data-template="xlsx" type="button">Excelのひな形（.xlsx）</button></div><details><summary>入力する列と条件</summary><p>${schema.min}〜${schema.max.toLocaleString('ja-JP')}件。ファイルは5MB以内です。</p><dl>${schema.columns.map(c=>`<div><dt>${esc(c.name)}</dt><dd>${esc(typeDescription(c))}</dd></div>`).join('')}</dl><p>CSVはUTF-8、Excelは「データ」シート（なければ先頭シート）を読み込みます。数式は計算結果を値として貼り付けてください。</p></details></section><section><h3>2. データをアップロード</h3><label class="data-file-label" for="data-file">CSV・Excelファイルを選ぶ<input id="data-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><p id="import-status" role="status" aria-live="polite"></p><div id="import-validation"></div></section></div><footer><button id="data-import-apply" type="button" disabled>このデータを使う</button><button id="data-import-cancel" type="button">キャンセル</button></footer>`;
  document.body.append(dialog);let controller=new AbortController(),candidate=null,sequence=0;
  const $=s=>dialog.querySelector(s),status=$('#import-status'),result=$('#import-validation'),confirm=$('#data-import-apply');
  const close=()=>dialog.close();$('#data-import-close').onclick=close;$('#data-import-cancel').onclick=close;
  dialog.addEventListener('close',()=>{sequence++;controller.abort();dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});},{once:true});
  dialog.querySelectorAll('[data-template]').forEach(b=>b.onclick=async()=>{b.disabled=true;status.textContent='ひな形を作成しています…';try{await downloadTemplate(schema,b.dataset.template,controller.signal);status.textContent='ひな形を保存しました。入力例を置き換えてから読み込んでください。';}catch(e){status.textContent=e.message;}finally{b.disabled=false;}});
  $('#data-file').onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    controller.abort();controller=new AbortController();const serial=++sequence;candidate=null;confirm.disabled=true;result.replaceChildren();status.textContent='ファイルを端末内で読み込んでいます…';
    try{
      const doc=await readFile(file,schema,controller.signal);if(serial!==sequence)return;
      status.textContent='列・値・分析条件を確認しています…';await new Promise(r=>setTimeout(r,0));
      if(serial!==sequence)return;const check=validateInput(doc,schema);
      if(doc.otherSheets.length)check.warnings.push({message:`「${doc.otherSheets.join('、')}」シートは使いません。「データ」または先頭シートだけを取り込みます。`});
      let shown=100;
      const show=()=>{
        result.innerHTML=`${check.errors.length?`<section class="import-errors" role="alert"><h4>修正が必要です（${check.errors.length}件）</h4><ol>${check.errors.slice(0,shown).map(e=>`<li>${esc(e.message)}</li>`).join('')}</ol>${check.errors.length>shown?'<button id="import-more-errors" type="button">残りのエラーをさらに表示</button>':''}</section>`:''}${check.warnings.length?`<section class="import-warnings"><h4>確認して使える内容（${check.warnings.length}件）</h4><ul>${check.warnings.map(e=>`<li>${esc(e.message)}</li>`).join('')}</ul></section>`:''}${check.valid?`<div class="import-success"><strong>${esc(check.data.name)}</strong><p>${check.data.rows.length}件 · ${check.data.headers.map(esc).join(' / ')}</p><p>「このデータを使う」を押すとグラフと集計を更新します。</p></div>`:''}`;
        $('#import-more-errors')?.addEventListener('click',()=>{shown+=100;show();});
      };show();status.textContent=check.valid?'確認が終わりました。':'元のデータは変更されていません。ファイルを修正して選び直してください。';
      if(check.valid){candidate={...check.data,filename:file.name};confirm.disabled=false;confirm.textContent=check.warnings.length?'確認した内容でこのデータを使う':'このデータを使う';}
    }catch(e){if(serial!==sequence)return;status.textContent='ファイルを確認できません。';result.innerHTML=`<p class="import-errors" role="alert">${esc(e.message)}</p>`;}
  };
  confirm.onclick=async()=>{
    if(!candidate)return;confirm.disabled=true;status.textContent='データを反映しています…';
    try{await apply(candidate);close();}catch(e){result.innerHTML=`<p class="import-errors" role="alert">${esc(e.message)}</p>`;confirm.disabled=false;status.textContent='反映できません。入力条件を確認してください。';}
  };
  dialog.showModal();$('#data-file').focus();
}
