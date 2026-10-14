(function(){
  'use strict';
  const schedule=typeof module!=='undefined'&&module.exports ? require('./course-schedule.js') : window.KejianSchedule;
  const DAYS=['一','二','三','四','五','六','日'];
  // Keep OCR line and field boundaries until their roles have been identified.
  const tidy=value=>String(value||'').replace(/\r\n?/g,'\n').replace(/：/g,':').replace(/[—–~～]/g,'-').replace(/(?<=\d)[ \t]*至[ \t]*(?=\d)/g,'-').replace(/(\d)[ \t]*:[ \t]*(\d)/g,'$1:$2').trim();
  const compact=value=>tidy(value).replace(/([\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g,'$1');
  const cleanField=value=>compact(value).replace(/[（(]\s*[）)]/g,'').replace(/^[\s@·|/,:;，；、-]+|[\s@·|/,:;，；、-]+$/g,'').trim();
  const dayPattern=/(?:星[ \t]*期|周|礼[ \t]*拜)[ \t]*([一二三四五六日天])|\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/ig;
  const roomSource='(?:[A-Z]{1,2}[ \\t]*[-·]?[ \\t]*\\d{2,4}(?:[ \\t]*-[ \\t]*\\d{2,4})?|\\d{1,2}[ \\t]*-[ \\t]*\\d{2,4}|\\d{3,5}(?:教室)?)';
  const buildingNames=['教学楼','实验楼','综合楼','实训楼','文科楼','理科楼','信息楼','科技楼','工程楼','艺术楼','体育馆','图书馆','逸夫楼','博学楼','明德楼','致远楼','求是楼','主楼'];
  const chineseLabels=names=>names.map(name=>[...name].join('[ \\t]*')).join('|');
  const knownBuildings=chineseLabels(buildingNames);
  const campusSource='(?:[东南西北中新老主]{1,3}(?:校区|院)[ \\t·/-]*)?';
  const buildingSource=`(?:(?:[一二三四五六七八九十\\d]+号?[ \\t]*)?(?:${knownBuildings})|[一二三四五六七八九十\\d]+[ \\t]*(?:号楼|教)|教[一二三四五六七八九十\\d]+楼)`;
  const knownPlace=new RegExp(`${campusSource}${buildingSource}(?:[ \\t·/-]*${roomSource})?(?=$|[ \\t，；;、|/()（）])`,'i');
  const namedPlace=new RegExp(`(?:^|[ \\t@·|/,:;，；、(（])(${campusSource}(?:[\\u3400-\\u9fff]{1,10}|\\d+号?)(?:楼|馆|中心|教室)(?:[ \\t·/-]*${roomSource})?)(?=$|[ \\t，；;、|/()（）])`,'i');
  // Unlabelled plain numbers are rooms only on their own line. A year or
  // course level attached to a title must not be removed as a room number.
  const roomPattern=/(?<![A-Z\d])(?:[A-Z]{1,2}[ \t]*[-·]?[ \t]*\d{2,4}(?:[ \t]*-[ \t]*\d{2,4})?|\d{1,2}[ \t]*-[ \t]*\d{2,4}|\d{3,5}教室)(?![A-Z\d])/i;
  const detailLabels=chineseLabels(['课程名称','课程名','科目','课程编号','课程代码','课程','任课教师','授课教师','教师','老师','班级','学分','选课号','人数','备注','上课时间','时间','周次']);
  const placeLabels=chineseLabels(['上课地点','地点','場地','场地','上课教室','教室']);
  const fields=new RegExp(`(${detailLabels}|Course(?:[ \\t]+name)?)[ \\t]*:[ \\t]*|(${placeLabels}|Location|Classroom|Room)(?:[ \\t]*:[ \\t]*|[ \\t]+|(?=[A-Z\\d]))`,'ig');
  const isLocation=label=>/地点|場地|场地|教室|location|classroom|room/i.test(compact(label));
  const isTitle=label=>/^(?:课程名称|课程名|科目|课程|course(?:[ \t]+name)?)$/i.test(compact(label));
  function stripSchedule(line){return tidy(line).replace(dayPattern,'').replace(/\b\d{1,2}:\d{2}[ \t]*-[ \t]*\d{1,2}:\d{2}\b/g,'').replace(/(?:第[ \t]*)?\d{1,2}[ \t]*(?:[-,、][ \t]*\d{1,2})?[ \t]*节/g,'').replace(/(?:第[ \t]*)?\d{1,2}(?:[ \t]*[-,，、][ \t]*\d{1,2})*[ \t]*周(?:[（(][单双][）)])?/g,'').replace(/[单双每][ \t]*周|[（(][ \t]*[单双][ \t]*[）)]/g,'').trim();}
  function locationKind(value){const text=compact(value);return /(?:校区|院)$/.test(text) ? 'campus' : /(?:楼|馆)[ \t]*[A-Z]?[ \t]*\d{1,2}$|(?:楼|馆)[ \t]*[A-Z]$/i.test(text) ? 'room-fragment' : /^(?:室外|室内)(?:羽毛|篮|足|网|排)$/.test(text) ? 'venue-fragment' : /(?:楼|馆|中心|教室)$/.test(text)&&!roomPattern.test(text) ? 'building' : 'complete';}
  function splitLocation(line){
    const text=tidy(line),known=text.match(knownPlace),named=text.match(namedPlace);let match=known,index=known?.index,value=known?.[0];
    if(named&&(!known||named.index<known.index)){value=named[1];index=named.index+named[0].indexOf(value);match=named;}
    // A narrow screenshot can wrap "宏智楼215" as "宏 智 楼 2" / "15".
    const whole=cleanField(text).replace(/^[“”"'‘’]+|[“”"'‘’]+$/g,'');
    if(!match&&/^(?:[\u3400-\u9fff]{1,4}(?:楼|馆|中心)[ \t]*[A-Z]?[ \t]*\d{0,4}(?:[ \t]*室)?|(?:室外|室内)(?:羽毛|篮|足|网|排)|(?:室外|室内)?(?:羽毛球场|篮球场|足球场|网球场|排球场|运动场|操场)[ \t]*\d*)$/i.test(whole))return {title:'',location:whole,kind:locationKind(whole)};
    if(!match){const room=text.match(roomPattern)||text.match(/^\d{3,5}$/);if(room){match=room;index=room.index;value=room[0];}}
    if(!match&&/^(?:[\u3400-\u9fff]{1,12}(?:校区|院)|操场|运动场|体育馆|图书馆|线上(?:教学)?|腾讯会议|网络教学)$/.test(compact(text)))return {title:'',location:cleanField(text),kind:locationKind(text)};
    if(!match)return {title:cleanField(text),location:'',kind:''};
    return {title:cleanField(text.slice(0,index)+' '+text.slice(index+value.length)),location:cleanField(value),kind:locationKind(value)};
  }
  function courseFields(lines,joinTitle=false){
    const titles=[],explicitTitles=[],places=[];let pendingLocation=false;
    function addPlace(value,kind,index){
      value=cleanField(value);if(!value)return;const previous=places.at(-1);
      // A building and its room can wrap onto adjacent OCR lines. Join only
      // location fragments, never the neighboring course/teacher text.
      if(previous&&index<=previous.index+1&&(previous.kind==='room-fragment'&&/^\d{1,4}[ \t]*(?:室|教室)?$/.test(value)||previous.kind==='venue-fragment'&&/^球场[ \t]*\d*$/.test(value))){previous.value=previous.value.replace(/\s/g,'')+value.replace(/\s/g,'');previous.kind='complete';previous.index=index;}
      else if(previous&&index<=previous.index+1&&(previous.kind==='campus'||previous.kind==='building'&&kind==='complete'&&new RegExp(`^${roomSource}$`,'i').test(value))){previous.value+=' '+value;previous.kind=kind;previous.index=index;}
      else places.push({value,kind,index});
    }
    function addText(text,index,explicit=false){
      const part=splitLocation(text),previous=places.at(-1),beforeLocation=!places.length;
      if(!part.location&&previous&&index===previous.index+1&&(previous.kind==='room-fragment'&&/^\d{1,4}[ \t]*(?:室|教室)?$/.test(part.title)||previous.kind==='venue-fragment'&&/^球场[ \t]*\d*$/.test(part.title))){addPlace(part.title,'complete',index);return;}
      if(part.location)addPlace(part.location,part.kind,index);
      if(part.title&&!/^(?:上午|下午|晚上|早上|课表|课程表|时间|节次|周次|\d+)$/.test(part.title)&&(explicit||!joinTitle||beforeLocation))(explicit ? explicitTitles : titles).push({text:part.title,index});
    }
    lines.forEach((raw,index)=>{
      const line=stripSchedule(raw);if(!line)return;const labels=[...line.matchAll(fields)];
      if(!labels.length){if(pendingLocation){addPlace(line,locationKind(line),index);pendingLocation=false;}else addText(line,index);return;}
      addText(line.slice(0,labels[0].index),index);
      labels.forEach((match,i)=>{
        const label=match[1]||match[2],value=cleanField(line.slice(match.index+match[0].length,labels[i+1]?.index??line.length));
        if(isLocation(label)){if(value){addPlace(value,locationKind(value),index);pendingLocation=false;}else pendingLocation=true;}
        else if(isTitle(label))addText(value,index,true);
      });
    });
    const parts=explicitTitles.length ? explicitTitles : titles;let title=parts[0]?.text||'';
    if(joinTitle)for(let i=1;i<parts.length&&parts[i].index===parts[i-1].index+1;i++)title+=/^[A-Z]+$/i.test(parts[i].text)&&/[A-Z]$/i.test(title) ? ' '+parts[i].text : parts[i].text;
    return {title:cleanField(title).replace(/^[“”"'‘’]+|[“”"'‘’]+$/g,'').replace(/[ \t]*\.{2,}/g,'…'),location:places[0]?.value||''};
  }
  function dayOf(text){const match=[...tidy(text).matchAll(dayPattern)][0];return !match ? 0 : match[1] ? (match[1]==='天' ? 7 : DAYS.indexOf(match[1])+1) : ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].indexOf(match[2].toLowerCase())+1;}
  function timeRange(text){const match=tidy(text).match(/\b(\d{1,2})\s*:\s*([0-5]\s*\d)\s*-\s*(\d{1,2})\s*:?\s*([0-5]\s*\d)\b/);if(!match)return null;const start=match[1].padStart(2,'0')+':'+match[2].replace(/\s/g,''),end=match[3].padStart(2,'0')+':'+match[4].replace(/\s/g,'');return start<end&&Number(match[1])<24&&Number(match[3])<24 ? {startTime:start,endTime:end} : null;}
  function candidate(text,weekday=0,confidence=0,{joinTitle=false}={}){
    const raw=tidy(text),lines=raw.split(/\n+/).map(tidy).filter(Boolean),times=timeRange(raw),period=raw.match(/(?:第\s*)?(\d{1,2})\s*[-,、]\s*(\d{1,2})\s*节/)||raw.match(/第\s*(\d{1,2})\s*节/);
    const repeatText=compact(raw),repeat=/单周|[（(]\s*单\s*[）)]|\bodd\b/i.test(repeatText) ? 'odd' : /双周|[（(]\s*双\s*[）)]|\beven\b/i.test(repeatText) ? 'even' : 'all';
    const {title,location}=courseFields(lines,joinTitle);
    if(!title)return null;
    const weeks=raw.match(/(?:第\s*)?\d+\s*(?:[-,、]\s*\d+)?\s*周(?:[（(][单双][）)])?/g);
    return {title:title.slice(0,80),weekday:weekday||dayOf(raw),repeat,startTime:times?.startTime||'',endTime:times?.endTime||'',location:location.slice(0,120),notes:weeks ? '原图周次：'+weeks.join('、')+'；请核对适用范围。' : '',weeks:schedule.weeksFromText(raw)||[...schedule.ALL_WEEKS],adjustments:[],periodStart:period ? Number(period[1]) : 0,periodEnd:period ? Number(period[2]||period[1]) : 0,confidence,source:raw};
  }
  function rowsFromWords(words){
    const rows=[];for(const word of [...words].sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0)){const h=Math.max(8,word.bbox.y1-word.bbox.y0),mid=(word.bbox.y0+word.bbox.y1)/2;let row=rows.find(row=>Math.abs(row.mid-mid)<Math.max(h,row.height)*.55);if(!row){row={mid,height:h,words:[]};rows.push(row);}row.words.push(word);}
    return rows.sort((a,b)=>a.mid-b.mid).map(row=>{const sorted=row.words.sort((a,b)=>a.bbox.x0-b.bbox.x0);return {text:tidy(sorted.map(w=>w.text).join(' ')),words:sorted,bbox:{x0:Math.min(...sorted.map(w=>w.bbox.x0)),y0:Math.min(...sorted.map(w=>w.bbox.y0)),x1:Math.max(...sorted.map(w=>w.bbox.x1)),y1:Math.max(...sorted.map(w=>w.bbox.y1))},confidence:sorted.reduce((sum,w)=>sum+(w.confidence||0),0)/sorted.length};});
  }
  function axisBands(rows){
    const starts=rows.filter(row=>/^第[一二三四五六七八九十\d]+大节/.test(compact(row.text)));
    return starts.map((row,index)=>{
      const bottom=starts[index+1]?.bbox.y0??Infinity,text=rows.filter(item=>item.bbox.y0>=row.bbox.y0&&item.bbox.y0<bottom).map(item=>item.text).join('\n'),small=compact(text).match(/[（(]?(\d{1,2}(?:[ \t]*[,、][ \t]*\d{1,2})+)[ \t\n]*\)?小\s*节/),periods=small ? small[1].split(/[,、]/).map(Number) : [];
      return {top:row.bbox.y0,bottom,...timeRange(text),periodStart:periods[0]||0,periodEnd:periods.at(-1)||0};
    });
  }
  function ocrLayout(data){
    const lines=(data.blocks||[]).flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>paragraph.lines||[])),words=lines.flatMap(line=>line.words?.length ? line.words : [{text:line.text,bbox:line.bbox,confidence:line.confidence}]).filter(word=>word.text?.trim()&&word.bbox);
    const headers=[];
    for(const line of lines){const text=line.text.replace(/\s/g,''),matches=[...text.matchAll(dayPattern)];let offset=0;const spans=(line.words||[]).map(word=>{const start=offset;offset+=word.text.replace(/\s/g,'').length;return {start,end:offset,bbox:word.bbox};});for(const match of matches){const covered=spans.filter(span=>span.end>match.index&&span.start<match.index+match[0].length);const box=covered.length ? {x0:Math.min(...covered.map(s=>s.bbox.x0)),x1:Math.max(...covered.map(s=>s.bbox.x1)),y0:line.bbox.y0,y1:line.bbox.y1} : line.bbox;if(box)headers.push({weekday:dayOf(match[0]),x:(box.x0+box.x1)/2,y:(box.y0+box.y1)/2,box});}}
    const clusters=headers.map(header=>headers.filter(other=>Math.abs(other.y-header.y)<25));const headerRow=clusters.sort((a,b)=>new Set(b.map(h=>h.weekday)).size-new Set(a.map(h=>h.weekday)).size)[0]||[];const unique=[...new Map(headerRow.map(h=>[h.weekday,h])).values()].sort((a,b)=>a.weekday-b.weekday);
    if(unique.length<3)return null;
    const pairs=unique.slice(1).map((h,i)=>(h.x-unique[i].x)/(h.weekday-unique[i].weekday)).filter(n=>n>10),spacing=pairs.sort((a,b)=>a-b)[Math.floor(pairs.length/2)];if(!spacing)return null;
    const anchor=unique[0],firstX=anchor.x-(anchor.weekday-1)*spacing,left=firstX-spacing*.5,top=Math.max(...unique.map(h=>h.box.y1))+4,axisRows=rowsFromWords(words.filter(w=>(w.bbox.x0+w.bbox.x1)/2<left&&w.bbox.y0>top));
    return {words,firstX,spacing,top,axisRows,bands:axisBands(axisRows)};
  }
  function gridCells(layout,width,height){
    if(!layout||layout.bands.length<2)return [];const cells=[];
    for(let weekday=1;weekday<=7;weekday++)for(const band of layout.bands){
      const center=layout.firstX+(weekday-1)*layout.spacing,left=Math.max(0,Math.ceil(center-layout.spacing*.5+3)),right=Math.min(width,Math.floor(center+layout.spacing*.5-3)),words=layout.words.filter(word=>{const x=(word.bbox.x0+word.bbox.x1)/2,y=(word.bbox.y0+word.bbox.y1)/2;return x>=left&&x<right&&y>=band.top&&y<band.bottom;});if(!words.length)continue;
      const margin=layout.spacing*.07,top=Math.max(band.top,Math.floor(Math.min(...words.map(w=>w.bbox.y0))-margin)),bottom=Math.min(height,band.bottom,Math.ceil(Math.max(...words.map(w=>w.bbox.y1))+margin));if(right<=left||bottom<=top)continue;
      cells.push({weekday,band,rectangle:{left,top:Math.floor(top),width:right-left,height:Math.floor(bottom-top)}});
    }
    return cells.slice(0,100);
  }
  function parseOCR(data){
    let drafts=[];const layout=ocrLayout(data);
    if(layout){
        const {words,firstX,spacing,top,axisRows,bands}=layout,axisTimes=axisRows.filter(row=>timeRange(row.text)).map(row=>({...timeRange(row.text),y:row.bbox.y0}));
        const axisPeriods=axisRows.map(row=>{const match=row.text.match(/(?:第\s*)?(\d{1,2})\s*(?:[-,、]\s*(\d{1,2}))?\s*节/);return match ? {start:Number(match[1]),end:Number(match[2]||match[1]),y:row.bbox.y0} : null;}).filter(Boolean);
        for(let weekday=1;weekday<=7;weekday++){
          const center=firstX+(weekday-1)*spacing,colWords=words.filter(w=>{const x=(w.bbox.x0+w.bbox.x1)/2;return w.bbox.y0>top&&x>=center-spacing*.5&&x<center+spacing*.5;});
          const rows=rowsFromWords(colWords),groups=[];
          if(bands.length>=2){for(const band of bands){const group=rows.filter(row=>row.bbox.y0>=band.top&&row.bbox.y0<band.bottom);if(group.length)groups.push(group);}}
          else for(const row of rows){const previous=groups.at(-1)?.at(-1);if(!previous||row.bbox.y0-previous.bbox.y1>Math.max(18,(previous.bbox.y1-previous.bbox.y0)*1.7))groups.push([row]);else groups.at(-1).push(row);}
          for(const group of groups){const item=candidate(group.map(row=>row.text).join('\n'),weekday,group.reduce((sum,row)=>sum+row.confidence,0)/group.length,{joinTitle:true});if(!item)continue;const band=bands.find(band=>group[0].bbox.y0>=band.top&&group[0].bbox.y0<band.bottom);if(band){if(!item.startTime&&band.startTime){item.startTime=band.startTime;item.endTime=band.endTime;}item.periodStart||=band.periodStart;item.periodEnd||=band.periodEnd;}
            if(!item.startTime&&axisTimes.length){const y=group[0].bbox.y0,sorted=[...axisTimes].sort((a,b)=>Math.abs(a.y-y)-Math.abs(b.y-y));if(Math.abs(sorted[0].y-y)<100){item.startTime=sorted[0].startTime;item.endTime=sorted[0].endTime;}}
            if(!item.periodStart&&axisPeriods.length){const y=group[0].bbox.y0,nearest=[...axisPeriods].sort((a,b)=>Math.abs(a.y-y)-Math.abs(b.y-y))[0];if(Math.abs(nearest.y-y)<100){item.periodStart=nearest.start;item.periodEnd=nearest.end;}}
            drafts.push(item);
          }
        }
    }
    if(!drafts.length){const text=tidy(data.text),groups=[];for(const line of text.split(/\n+/).map(tidy).filter(Boolean)){const current=groups.at(-1);if(!current)groups.push([line]);else if(dayOf(line)&&current.some(value=>dayOf(value))||timeRange(line)&&current.some(value=>timeRange(value)))groups.push([line]);else current.push(line);}
      drafts=groups.map(group=>candidate(group.join('\n'),0,data.confidence||0)).filter(Boolean);
    }
    const seen=new Set();return drafts.filter(item=>{const key=[item.weekday,item.title,item.startTime,item.endTime,item.repeat,item.location].join('|');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,100);
  }
  function applyPeriods(item,periods){const first=periods[item.periodStart],last=periods[item.periodEnd];if(!item.startTime&&first?.startTime)item.startTime=first.startTime;if(!item.endTime&&last?.endTime)item.endTime=last.endTime;return item;}
  function mergeCourses(existing,incoming){const signature=course=>[course.title,course.weekday,course.repeat||'all',course.startTime,course.endTime,course.location,(course.weeks||schedule.ALL_WEEKS).filter(week=>schedule.matchesRepeat(week,course.repeat)).sort((a,b)=>a-b).join(',')].join('|'),seen=new Set(existing.map(signature));let skipped=0;const added=incoming.filter(course=>{const key=signature(course);if(seen.has(key)){skipped++;return false;}seen.add(key);return true;});return {courses:[...existing,...added],added:added.length,skipped};}
  if(typeof module!=='undefined'&&module.exports)module.exports={candidate,parseOCR,dayOf,timeRange,applyPeriods,mergeCourses,ocrLayout,gridCells};
  if(typeof document==='undefined')return;
  const $=selector=>document.querySelector(selector);let api,worker=null,job=0,drafts=[],source='',preview='';
  const dialog=$('#course-import-dialog'),form=$('#course-import-form');
  function status(text,percent=0){$('#ocr-status').textContent=text;$('#ocr-progress').value=percent;}
  function renderDrafts(){
    $('#import-candidates').innerHTML=drafts.map((item,index)=>`<article class="import-candidate" data-import-index="${index}"><div class="import-candidate-head"><label class="inline-checkbox"><input type="checkbox" name="include-${index}" checked><span>课程 ${String(index+1).padStart(2,'0')}</span></label><span class="review-badge">${!item.weekday||!item.startTime||!item.endTime||!item.location ? '待补充' : item.confidence<75 ? '重点核对' : '请核对'}</span><button type="button" class="icon-button" data-remove-import="${index}" aria-label="移除课程">${api.icon('close')}</button></div><label>课程名称<input name="title-${index}" value="${api.escape(item.title)}" maxlength="80" required></label><div class="import-pair"><label>上课日<select name="weekday-${index}" required><option value="">请选择</option>${DAYS.map((day,i)=>`<option value="${i+1}" ${item.weekday===i+1 ? 'selected' : ''}>周${day}</option>`).join('')}</select></label><label>上课周次<select name="repeat-${index}">${['all','odd','even'].map((repeat,i)=>`<option value="${repeat}" ${item.repeat===repeat ? 'selected' : ''}>${['每周','单周','双周'][i]}</option>`).join('')}</select></label></div><details class="import-week-settings"><summary>上课周数 · <span data-import-week-summary>${schedule.summary(item.weeks)}</span></summary><input type="hidden" name="weeks-${index}"><div class="week-picker" data-week-input="weeks-${index}"></div></details><div class="time-pair"><label>开始时间<input type="time" name="startTime-${index}" value="${item.startTime}" required></label><label>结束时间<input type="time" name="endTime-${index}" value="${item.endTime}" required></label></div><label>上课地点<input name="location-${index}" value="${api.escape(item.location)}" maxlength="120" required placeholder="补充教室或地点"></label><label>备注<textarea name="notes-${index}" rows="2" maxlength="500">${api.escape(item.notes)}</textarea></label>${item.periodStart ? `<p class="form-hint">原图：第 ${item.periodStart}${item.periodEnd!==item.periodStart ? '–'+item.periodEnd : ''} 节，可在上方设置作息填入时间。</p>` : ''}<details class="source-text"><summary>查看原图识别文字</summary><p>${api.escape(item.source)}</p></details></article>`).join('');
    drafts.forEach((item,index)=>{form.elements[`include-${index}`].checked=item.include!==false;});
    drafts.forEach((item,index)=>schedule.renderPicker(document.querySelector(`[data-week-input="weeks-${index}"]`),item.weeks||schedule.ALL_WEEKS,item.repeat));
    $('#import-review').hidden=false;$('#import-summary').textContent=drafts.length ? `识别出 ${drafts.length} 条候选课程` : '没有自动找到课程';$('#import-hint').textContent=drafts.length ? '对照原图检查名称、星期、时间、地点与单双周，确认后再保存。' : '可在下方查看识别文字并手动补充课程；清晰、正向的课表截图更容易识别。';$('#import-save').disabled=!drafts.length;updateIncludes();
  }
  function readDrafts(){drafts=drafts.map((item,index)=>{for(const field of ['title','weekday','repeat','startTime','endTime','location','notes'])item[field]=form.elements[`${field}-${index}`].value;item.weekday=Number(item.weekday);item.weeks=schedule.readPicker(document.querySelector(`[data-week-input="weeks-${index}"]`));item.include=form.elements[`include-${index}`].checked;return item;});}
  function updateIncludes(){let selected=0;drafts.forEach((item,index)=>{const checked=form.elements[`include-${index}`].checked;selected+=checked;document.querySelector(`[data-import-index="${index}"]`).classList.toggle('excluded',!checked);for(const field of ['title','weekday','repeat','startTime','endTime','location','notes'])form.elements[`${field}-${index}`].disabled=!checked;});$('#import-save').disabled=!selected;$('#import-save').textContent=`确认导入 ${selected} 门课程`;}
  function reset(){job++;worker?.terminate();worker=null;drafts=[];source='';preview='';$('#import-review').hidden=true;$('#import-image-wrap').hidden=true;$('#import-recognize').disabled=true;$('#import-raw').textContent='';$('#course-screenshot').value='';status('选择一张清晰的课表截图');}
  function open(){reset();window.KejianMotion.open(dialog);}
  async function loadImage(data){
    const token=++job;worker?.terminate();worker=null;drafts=[];$('#import-review').hidden=true;status('正在读取截图…');
    try{const img=new Image();img.src=data;await img.decode();if(token!==job)return;if(img.naturalWidth*img.naturalHeight>40000000||img.naturalWidth<80||img.naturalHeight<80)throw new Error('请使用清晰的课表截图，图片不要超过 4000 万像素');const canvas=document.createElement('canvas'),scale=Math.min(2,2400/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);preview=canvas.toDataURL('image/png');$('#import-image').src=preview;$('#import-image-wrap').hidden=false;$('#import-recognize').disabled=false;status('截图已就绪，点击开始识别');}catch(error){if(token===job){preview='';$('#import-image-wrap').hidden=true;$('#import-recognize').disabled=true;status(error.message||'无法读取图片，请使用 PNG、JPG 或 WebP');}}
  }
  function script(){if(window.Tesseract)return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./assets/ocr/tesseract.min.js';script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('无法加载识别组件，请重新打开应用'));};document.head.append(script);});}
  function readableCell(img,rectangle){
    const canvas=document.createElement('canvas'),padding=20;canvas.width=rectangle.width+padding*2;canvas.height=rectangle.height+padding*2;
    const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,rectangle.left,rectangle.top,rectangle.width,rectangle.height,padding,padding,rectangle.width,rectangle.height);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height),gray=index=>(pixels.data[index]*299+pixels.data[index+1]*587+pixels.data[index+2]*114)/1000;
    const corners=[[padding,padding],[canvas.width-padding-1,padding],[padding,canvas.height-padding-1],[canvas.width-padding-1,canvas.height-padding-1]].map(([x,y])=>gray((y*canvas.width+x)*4)).sort((a,b)=>a-b),dark=corners[2]<128;
    for(let y=padding;y<canvas.height-padding;y++)for(let x=padding;x<canvas.width-padding;x++){const index=(y*canvas.width+x)*4,value=(dark ? 255-gray(index) : gray(index))<170 ? 0 : 255;pixels.data[index]=pixels.data[index+1]=pixels.data[index+2]=value;}
    context.putImageData(pixels,0,0);return canvas.toDataURL('image/png');
  }
  function textConfidence(data){const values=(data.blocks||[]).flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>(paragraph.lines||[]).map(line=>line.confidence))).filter(Number.isFinite);return Math.min(data.confidence||0,...values);}
  async function recognize(){
    if(!preview)return;const token=++job,image=preview;let ownedWorker=null,refining=false;
    $('#import-recognize').disabled=true;$('#import-review').hidden=true;$('#import-pick').disabled=true;status('正在准备本地识别…',2);
    try{
      await script();if(token!==job)return;
      const base=new URL('./assets/ocr/',location.href).href;
      ownedWorker=await Tesseract.createWorker(['chi_sim','eng'],1,{workerPath:base+'worker.min.js',corePath:base,langPath:base,workerBlobURL:false,cacheMethod:'none',logger:message=>{if(token!==job||refining)return;const recognizing=message.status==='recognizing text';status(recognizing ? '正在识别课程与时间…' : '正在准备本地识别…',recognizing ? 25+Math.round(message.progress*40) : 5+Math.round(message.progress*15));},errorHandler:()=>{}});
      if(token!==job)return;worker=ownedWorker;
      await ownedWorker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1',user_defined_dpi:'150'});
      const {data}=await ownedWorker.recognize(image,{}, {text:true,blocks:true});if(token!==job)return;
      source=data.text||'';drafts=parseOCR(data);
      const img=$('#import-image'),cells=gridCells(ocrLayout(data),img.naturalWidth,img.naturalHeight);
      if(cells.length){
        refining=true;const refined=[];await ownedWorker.setParameters({tessedit_pageseg_mode:'6'});
        for(const [index,cell] of cells.entries()){
          if(token!==job)return;status(`正在分别识别课程名与地点 ${index+1}/${cells.length}…`,65+Math.round(index/cells.length*30));
          let {data:part}=await ownedWorker.recognize(image,{rectangle:cell.rectangle},{text:true,blocks:true});if(token!==job)return;
          if(textConfidence(part)<75){const {data:retry}=await ownedWorker.recognize(readableCell(img,cell.rectangle),{},{text:true,blocks:true});if(token!==job)return;if(retry.confidence>=85&&retry.confidence>part.confidence+6&&candidate(retry.text,cell.weekday,0,{joinTitle:true})?.location)part=retry;}
          let item=candidate(part.text,cell.weekday,textConfidence(part),{joinTitle:true});const fallback=drafts.find(item=>item.weekday===cell.weekday&&item.startTime===cell.band.startTime);
          if(!item?.location&&fallback)item=fallback;
          if(item){item.startTime||=cell.band.startTime||'';item.endTime||=cell.band.endTime||'';item.periodStart||=cell.band.periodStart;item.periodEnd||=cell.band.periodEnd;refined.push(item);}
        }
        if(refined.length===drafts.length&&refined.every(item=>item.title&&item.location))drafts=refined;
      }
      drafts.forEach(item=>{if(item.title.includes('…'))item.notes+=(item.notes ? '\n' : '')+'原图课程名已截断，完整名称请对照学校课表补充。';});
      $('#import-raw').textContent=source||'未识别到文字';status('识别完成，请校对后保存',100);renderDrafts();
    }catch(error){if(token===job){status('识别未完成，请重试或换一张更清晰的截图');api.toast('识别失败，截图仍可重新选择');}}
    finally{ownedWorker?.terminate();if(worker===ownedWorker)worker=null;if(token===job){$('#import-recognize').disabled=false;$('#import-pick').disabled=false;}}
  }
  document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-course-import')&&api)open();if(button.dataset.removeImport!==undefined){readDrafts();drafts.splice(Number(button.dataset.removeImport),1);renderDrafts();}});
  $('#import-pick').addEventListener('click',()=>{if(window.KejianNative?.importCourseImage)window.KejianNative.importCourseImage();else $('#course-screenshot').click();});
  $('#course-screenshot').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;if(file.size>12*1024*1024){status('截图不能超过 12 MB');return;}const reader=new FileReader();reader.onload=()=>loadImage(reader.result);reader.onerror=()=>status('无法读取截图，请重新选择');reader.readAsDataURL(file);});
  $('#import-recognize').addEventListener('click',recognize);
  $('#import-add-row').addEventListener('click',()=>{readDrafts();if(drafts.length>=100){api.toast('一次最多导入 100 门课程');return;}drafts.push({title:'',weekday:0,repeat:'all',startTime:'',endTime:'',location:'',notes:'',source:'手动补充',confidence:0});renderDrafts();});
  form.addEventListener('change',event=>{if(event.target.name.startsWith('include-'))updateIncludes();if(event.target.name.startsWith('repeat-')){const index=event.target.name.slice(7),container=document.querySelector(`[data-week-input="weeks-${index}"]`);schedule.renderPicker(container,schedule.readPicker(container),event.target.value);}});
  form.addEventListener('course-weeks-change',event=>{const container=event.target.closest('.week-picker');if(container)container.closest('details').querySelector('[data-import-week-summary]').textContent=schedule.summary(schedule.readPicker(container));});
  $('#apply-periods').addEventListener('click',()=>{readDrafts();const periods={};for(let i=1;i<=12;i++)periods[i]={startTime:$('#period-times').querySelector(`[name=period-start-${i}]`).value,endTime:$('#period-times').querySelector(`[name=period-end-${i}]`).value};drafts.forEach(item=>applyPeriods(item,periods));renderDrafts();api.toast('已填入对应节次的空白时间，请核对');});
  form.addEventListener('submit',event=>{event.preventDefault();readDrafts();const selected=drafts.filter(item=>item.include);if(!selected.length)return;const incoming=selected.map(item=>({id:crypto.randomUUID?.()||`course-${Date.now()}-${Math.random().toString(36).slice(2)}`,title:item.title,weekday:item.weekday,repeat:item.repeat,startTime:item.startTime,endTime:item.endTime,location:item.location,notes:item.notes,weeks:item.weeks,adjustments:[]}));try{window.KejianTimetable.normalizeCourses(incoming);}catch(error){api.toast('请补齐所选课程，并确保结束时间晚于开始时间');return;}const result=mergeCourses(api.getCourses(),incoming);if(result.courses.length>1000){api.toast('导入后不能超过 1000 门课程');return;}if(api.setCourses(result.courses)===false)return;window.KejianMotion.close(dialog);api.render();api.toast(`已导入 ${result.added} 门课程${result.skipped ? `，跳过 ${result.skipped} 门重复课程` : ''}`);});
  dialog.addEventListener('close',()=>{job++;worker?.terminate();worker=null;$('#import-pick').disabled=false;});
  window.kejianCourseImage=(data,error)=>{if(!dialog.open)return;if(error){status(error);return;}if(data)loadImage(data);};
  $('#period-times').innerHTML=Array.from({length:12},(_,index)=>`<div class="period-row"><span>第 ${index+1} 节</span><input type="time" name="period-start-${index+1}" aria-label="第${index+1}节开始时间"><span>—</span><input type="time" name="period-end-${index+1}" aria-label="第${index+1}节结束时间"></div>`).join('');
  window.KejianCourseImport={init(options){api=options;}};
})();
