import {esc} from '../shared/ui.mjs?v=20261026-final-upgrade';
export function showDataContext(root,data){
  for(const table of root.querySelectorAll('table')){
    if(table.closest('.table-scroll,.data-table,.histogram-frequency-table,.ct-table-scroll'))continue;
    const scroll=document.createElement('div');scroll.className='table-scroll analysis-table-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',table.caption?.textContent||'集計表');table.before(scroll);scroll.append(table);
  }
  const name=data.name||'自分のデータ';
  const header=root.querySelector('.workbench-display,.project-surface')||root;
  const target=header.querySelector(':scope > header')||header;
  if(!target.querySelector('.analysis-data-title'))target.insertAdjacentHTML('afterbegin',`<p class="analysis-data-title">${esc(name)} <span>全${data.rows.length.toLocaleString('ja-JP')}件</span></p>`);
  for(const svg of root.querySelectorAll('svg')){
    const description=svg.getAttribute('aria-label')||'統計グラフ';
    svg.setAttribute('aria-label',`${name}：${description}`);
    const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=`${name}：${description}`;svg.prepend(title);
  }
}

export function updateDataIntro(id,data){
 const intro=document.querySelector('.workspace-intro');if(!intro)return;
 if(!intro.dataset.standardIntro)intro.dataset.standardIntro=intro.textContent;
 const user=data.origin==='user';
 const descriptions={crosstab:'取り込んだ3つの分類で人数を数え、割合の分母と区分別・合計の違いを調べます。','time-series':'取り込んだ月別データで、長期的な変化、季節の繰り返し、伸び率を調べます。','hypothesis-test':'取り込んだ参加者ごとの試行数と正答数から、平均の比較、Z、正規分布表による判断へ進みます。','missing-values':'取り込んだ欠損データで、補完方法による平均・分散・日ごとの値の違いを調べます。'};
 intro.textContent=user?`「${data.name}」全${data.rows.length}件。${descriptions[id]||'同じデータを各タブの方法で分析します。'}`:intro.dataset.standardIntro;
 const sourceNotes=document.querySelectorAll('[data-standard-example]');sourceNotes.forEach(n=>n.hidden=user);
}
