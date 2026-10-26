/* ExcelJS 4.4.0, MIT, vendored locally. No network APIs or telemetry. */
importScripts('../vendor/exceljs-4.4.0.min.js');
self.onmessage=async({data})=>{
  try{
    const workbook=new ExcelJS.Workbook();
    if(data.operation==='write'){
      workbook.creator='Study Atlas';workbook.title=data.title||'データ';
      const sheet=workbook.addWorksheet('データ');
      // Values remain strings or numbers. ExcelJS formula objects are never created.
      data.rows.forEach(r=>sheet.addRow(r));
      sheet.columns.forEach((c,i)=>{c.width=i===0?28:24;});
      sheet.views=[{state:'frozen',ySplit:6}];
      sheet.getRow(6).font={bold:true};
      const help=workbook.addWorksheet('入力方法');
      [['Study Atlas データひな形'],['「データ」シートの入力例を自分のデータに置き換えてください。'],['2行目のB列に表題、4行目のB列以降に表示用の列名を入力します。'],['6行目は分析用の列名です。変更しないでください。'],['日付・月はYYYY-MM-DD／YYYY-MMの文字列で入力します。'],['数式は使わず、計算結果を値として貼り付けてください。'],['列名','形式'],...data.help].forEach(r=>help.addRow(r));
      help.columns=[{width:68},{width:75}];
      const bytes=await workbook.xlsx.writeBuffer();const buffer=bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);self.postMessage({ok:true,buffer},[buffer]);
    }else{
      await workbook.xlsx.load(data.buffer,{ignoreNodes:['dataValidations','drawing','picture','extLst']});
      const sheet=workbook.getWorksheet('データ')||workbook.worksheets[0];
      if(!sheet)throw Error('読み込めるシートがありません。');
      if(sheet.rowCount>10050||sheet.columnCount>50)throw Error('行数または列数が多すぎます。必要なデータだけを新しいシートにコピーしてください。');
      const rows=[],lineNumbers=[];
      sheet.eachRow({includeEmpty:false},(r,n)=>{
        const values=[];r.eachCell({includeEmpty:true},(c,i)=>{
          let v=c.value;
          if(v instanceof Date)v=v.toISOString().slice(0,10);
          else if(v&&typeof v==='object'&&Array.isArray(v.richText))v=v.richText.map(t=>t.text).join('');
          else if(v&&typeof v==='object'&&!v.formula&&!v.sharedFormula&&typeof v.text==='string')v=v.text;
          values[i-1]=v??'';
        });
        rows.push(Array.from({length:values.length},(_,i)=>values[i]??''));lineNumbers.push(n);
      });
      // Excel omits trailing blank cells. Restore the header width, not the values.
      const headerIndex=rows.findIndex(r=>!String(r[0]).startsWith('#')),width=rows[headerIndex]?.length||0;
      rows.slice(headerIndex+1).forEach(r=>{while(r.length<width)r.push('');});
      self.postMessage({ok:true,rows,lineNumbers,sheet:sheet.name,otherSheets:workbook.worksheets.filter(s=>s!==sheet&&s.name!=='入力方法').map(s=>s.name)});
    }
  }catch(error){self.postMessage({ok:false,message:error.message||'Excelを読み込めません。値だけの.xlsxファイルを保存し直してください。'});}
};
