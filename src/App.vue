<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import Icon from './Icon.vue'
import { getDemoService } from './demo.js'

const user=ref(null), ready=ref(false), busy=ref(false), csrf=ref(''), view=ref('seats')
const rooms=ref([]), slots=ref([]), seats=ref([]), bookings=ref([]), logs=ref([]), stats=ref({})
const roomId=ref(0), slotId=ref(0), selected=ref(null), filter=ref('ALL'), keyword=ref('')
const notices=ref([]), modal=ref(null), reason=ref(''), serverOffset=ref(0), clock=ref(Date.now())
const loginForm=reactive({username:'student',password:'Study@2026'})
const newRoom=reactive({name:'',location:'',description:'',rows:4,columns:6})
const demoTime=ref('')
const dateKey=(d)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)
const date=ref(dateKey(new Date())), isAdmin=computed(()=>user.value?.role==='ADMIN')
const currentRoom=computed(()=>rooms.value.find(r=>Number(r.id)===Number(roomId.value)))
const currentSlot=computed(()=>slots.value.find(s=>Number(s.id)===Number(slotId.value)))
const label={WAITING:'待签到',CHECKED_IN:'使用中',COMPLETED:'已完成',CANCELLED:'已取消',MISSED:'已失约'}
const dates=computed(()=>Array.from({length:7},(_,i)=>{let d=new Date(clock.value+serverOffset.value);d.setDate(d.getDate()+i);return {key:dateKey(d),title:i===0?'今天':i===1?'明天':new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',weekday:'short'}).format(d),day:new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric'}).format(d)}}))
const available=computed(()=>seats.value.filter(s=>s.enabled && !s.reservationId).length)
const ownActive=computed(()=>bookings.value.filter(b=>['WAITING','CHECKED_IN'].includes(b.status)))
const visibleBookings=computed(()=>bookings.value.filter(b=>(filter.value==='ALL'||b.status===filter.value)&&[b.roomName,b.seatCode,b.displayName,b.username,b.bookingDate].join(' ').toLowerCase().includes(keyword.value.toLowerCase())))
const seatRows=computed(()=>[...new Set(seats.value.map(s=>s.rowNo))])
const nav=computed(()=>isAdmin.value?[{key:'overview',name:'管理概览',icon:'grid'},{key:'records',name:'预约管理',icon:'calendar'},{key:'manage',name:'场地管理',icon:'chair'},{key:'logs',name:'操作记录',icon:'list'},{key:'guide',name:'使用指南',icon:'info'}]:[{key:'seats',name:'预约座位',icon:'grid'},{key:'mine',name:'我的预约',icon:'calendar'},{key:'guide',name:'使用指南',icon:'info'}])
const titles={seats:'预约座位',mine:'我的预约',overview:'管理概览',records:'预约管理',manage:'场地管理',logs:'操作记录',guide:'使用指南'}
const fmt=(v)=>v?String(v).replace('T',' ').slice(0,16):'—'
const time=(v)=>String(v||'').slice(0,5)
const now=()=>new Date(clock.value+serverOffset.value)
const demoClockText=computed(()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(now()))
const parseLocal=(v)=>new Date(v+(String(v).includes('+')?'':'+08:00'))
const canCheckin=(b)=>b.status==='WAITING'&&now()>=parseLocal(b.bookingDate+'T'+b.startTime)&&now()<parseLocal(b.checkinDeadline)
const canCancel=(b)=>b.status==='WAITING'&&now()<parseLocal(b.checkinDeadline)
const bookable=computed(()=>currentSlot.value&&parseLocal(date.value+'T'+currentSlot.value.endTime).getTime()-now().getTime()>900000)
const trend=computed(()=>Array.from({length:7},(_,i)=>{const d=new Date(now());d.setDate(d.getDate()-6+i);const key=dateKey(d);return {key,value:Number((stats.value.trend||[]).find(x=>x.bookingDate===key)?.total||0)}}))
const peak=computed(()=>Math.max(1,...trend.value.map(x=>x.value)))
function toast(text,type='success'){const n={id:Date.now()+Math.random(),text,type};notices.value.push(n);setTimeout(()=>notices.value=notices.value.filter(x=>x!==n),5500)}
async function api(path,options={}){
 return getDemoService().request(path,options)
}
async function session(){const s=await api('/session');csrf.value=s.csrfToken;user.value=s.user;clock.value=Date.now();serverOffset.value=parseLocal(s.serverTime).getTime()-clock.value}
async function quickLogin(username){loginForm.username=username;loginForm.password='Study@2026';await login()}
function openDemoClock(){demoTime.value=getDemoService().getTime().slice(0,16);modal.value={type:'demo'}}
async function syncDemo(){await session();date.value=dateKey(now());slotId.value=0;await initialize()}
async function advanceDemo(minutes){await act(async()=>{getDemoService().advance(minutes);modal.value=null;await syncDemo()},'演示时间已推进，预约状态已更新')}
async function applyDemoTime(){await act(async()=>{getDemoService().setTime(demoTime.value);modal.value=null;await syncDemo()},'演示时间已更新')}
async function jumpToBooking(b){await act(async()=>{getDemoService().setTime(b.bookingDate+'T'+b.startTime);await syncDemo()},'已到预约开始时间，可以签到了')}
async function resetDemo(){await act(async()=>{getDemoService().reset();modal.value=null;selected.value=null;roomId.value=0;await syncDemo()},'演示数据已重置，时间回到今天09:05')}
async function act(fn,message){if(busy.value)return;busy.value=true;try{await fn();if(message)toast(message)}catch(e){toast(e.message,'error')}finally{busy.value=false}}
async function login(){await act(async()=>{await api('/login',{method:'POST',body:new URLSearchParams(loginForm)});await session();view.value=isAdmin.value?'overview':'seats';await initialize()},'登录成功，欢迎回来')}
async function logout(){await act(async()=>{await api('/logout',{method:'POST'});user.value=null;selected.value=null;modal.value=null;await session()})}
async function initialize(){
 const [r,s]=await Promise.all([api(isAdmin.value?'/admin/rooms':'/rooms'),api('/slots')]);rooms.value=r;slots.value=s
 roomId.value=r.some(x=>x.id===roomId.value)?roomId.value:r[0]?.id||0
 if(!slotId.value)slotId.value=s.find(x=>parseLocal(date.value+'T'+x.endTime).getTime()-now().getTime()>900000)?.id||s[0]?.id||0
 await loadPage()
}
let seatRequest=0
async function loadSeats(){selected.value=null;if(!roomId.value||!slotId.value){seats.value=[];return}const n=++seatRequest;const result=await api('/rooms/'+roomId.value+'/seats?date='+date.value+'&slotId='+slotId.value);if(n===seatRequest)seats.value=result}
async function loadPage(){
 if(!user.value)return
 if(['seats','manage'].includes(view.value))await loadSeats()
 if(['mine','records','overview'].includes(view.value))bookings.value=await api(isAdmin.value?'/admin/reservations':'/reservations')
 if(view.value==='seats')bookings.value=await api('/reservations')
 if(view.value==='overview')stats.value=await api('/admin/stats')
 if(view.value==='logs')logs.value=await api('/admin/logs')
}
async function refresh(){await act(async()=>{await session();if(user.value)await initialize()},'已刷新')}
async function confirmBooking(){await act(async()=>{await api('/reservations',{method:'POST',body:JSON.stringify({seatId:selected.value.id,slotId:slotId.value,date:date.value})});modal.value=null;await loadPage()},'预约成功，请留意签到截止时间')}
function askCancel(b){modal.value={type:'cancel',booking:b};reason.value=''}
async function cancel(){await act(async()=>{const b=modal.value.booking;await api((isAdmin.value?'/admin':'')+'/reservations/'+b.id+'/cancel',{method:'POST',...(isAdmin.value?{body:JSON.stringify({reason:reason.value})}:{})});modal.value=null;await loadPage()},'预约已取消，座位已释放')}
async function checkin(b){await act(async()=>{await api('/reservations/'+b.id+'/checkin',{method:'POST'});await loadPage()},'签到成功，祝你学习顺利')}
async function toggleSeat(s){await act(async()=>{await api('/admin/seats/'+s.id,{method:'PATCH',body:JSON.stringify({enabled:!s.enabled})});await loadSeats()},s.enabled?'座位已停用':'座位已启用')}
async function toggleRoom(){await act(async()=>{await api('/admin/rooms/'+roomId.value,{method:'PATCH',body:JSON.stringify({enabled:!currentRoom.value.enabled})});await initialize()},'自习室状态已更新')}
async function addRoom(){await act(async()=>{const r=await api('/admin/rooms',{method:'POST',body:JSON.stringify(newRoom)});modal.value=null;roomId.value=r.id;await initialize()},'自习室和座位已创建')}
watch(view,()=>{filter.value='ALL';keyword.value='';loadPage().catch(e=>toast(e.message,'error'))})
watch([roomId,slotId,date],()=>{if(user.value && ['seats','manage'].includes(view.value))loadSeats().catch(e=>toast(e.message,'error'))})
let timer,refreshTimer
onMounted(async()=>{try{await session();date.value=dateKey(now());if(user.value){view.value=isAdmin.value?'overview':'seats';await initialize()}}catch(e){toast(e.message,'error')}finally{ready.value=true}
 timer=setInterval(()=>clock.value=Date.now(),1000)
 refreshTimer=setInterval(()=>{if(user.value&&!busy.value&&!modal.value)loadPage().catch(()=>{})},30000)
})
onUnmounted(()=>{clearInterval(timer);clearInterval(refreshTimer)})
</script>

<template>
 <div v-if="!ready" class="boot"><Icon name="book" :size="38"/><p>正在打开你的学习空间…</p></div>
 <div v-else-if="!user" class="login-page">
  <section class="login-story">
   <div class="brand"><span class="brand-icon"><Icon name="book" :size="25"/></span><span>阅间 <small>STUDY SPACE</small></span></div>
   <div><span class="eyebrow">A LITTLE SPACE. A LOT OF POSSIBILITIES.</span><h1>为专注，<br>留一个位置。</h1><p>从一张安静的书桌开始，<br>让每一次学习都有所收获。</p></div>
   <div class="desk-illustration" aria-hidden="true"><div class="window"><i/><i/><i/><i/></div><div class="book-stack"/><div class="lamp"/><div class="desk"/><div class="chair-shape"/></div>
   <span class="story-foot">自习室预约与签到 · 模拟数据演示版</span>
  </section>
  <section class="login-panel"><div class="login-box"><span class="eyebrow green">WELCOME BACK</span><h2>欢迎来到阅间</h2><p class="muted">使用演示账号体验完整流程，无需连接服务器。</p>
   <form @submit.prevent="login"><label>账号<input v-model.trim="loginForm.username" autocomplete="username" required maxlength="40" placeholder="请输入账号"></label><label>密码<input v-model="loginForm.password" type="password" autocomplete="current-password" required placeholder="请输入密码"></label><button class="primary full" :disabled="busy">登录学习空间 <Icon name="arrow" :size="18"/></button></form>
   <div class="demo-note"><Icon name="info" :size="18"/><div><strong>免费在线演示 · 数据仅保存在当前浏览器</strong><p>学生 student / student2 · 管理员 admin<br>统一密码 Study@2026</p><div class="demo-actions"><button :disabled="busy" @click="quickLogin('student')">学生一键体验</button><button :disabled="busy" @click="quickLogin('student2')">学生2体验</button><button :disabled="busy" @click="quickLogin('admin')">管理员体验</button></div></div></div>
  </div></section>
 </div>
 <div v-else class="app-shell">
  <aside class="sidebar">
   <div class="brand"><span class="brand-icon"><Icon name="book" :size="25"/></span><span>阅间<small>STUDY SPACE</small></span></div>
   <div class="nav-label">{{ isAdmin?'空间管理':'我的学习空间' }}</div>
   <nav><button v-for="n in nav" :key="n.key" :class="{active:view===n.key}" @click="view=n.key"><Icon :name="n.icon"/>{{n.name}}<span v-if="n.key==='mine'&&ownActive.length" class="nav-count">{{ownActive.length}}</span></button></nav>
   <div class="sidebar-tip"><span class="mini-leaf">✦</span><h4>把时间留给专注</h4><p>预约后请按时签到，<br>让每一张书桌都被善用。</p></div>
   <div class="profile"><span class="avatar">{{user.displayName.slice(0,1)}}</span><div><strong>{{user.displayName}}</strong><small>{{isAdmin?'空间管理员':'学生账号'}}</small></div><button class="icon-button" @click="logout" aria-label="退出登录" title="退出登录"><Icon name="exit" :size="18"/></button></div>
  </aside>
  <div class="main-shell">
   <header class="topbar"><div class="breadcrumb">学习空间 <span>/</span> <strong>{{titles[view]}}</strong></div><div class="topbar-right"><span class="live-dot"/>模拟演示<span class="date-label">{{dateKey(now())}}</span><button class="icon-button" @click="refresh" :disabled="busy" aria-label="刷新"><Icon name="refresh" :size="18"/></button></div></header>
   <main>
    <section class="demo-toolbar" aria-label="演示控制台"><div class="demo-toolbar-copy"><span class="demo-badge">DEMO</span><div><strong>模拟数据演示版</strong><p>数据只保存在此浏览器，不同访客互不影响。</p></div></div><div class="demo-controls"><button class="demo-clock" @click="openDemoClock" :disabled="busy"><Icon name="clock" :size="15"/>{{demoClockText}} <span>调整</span></button><button class="secondary small" @click="advanceDemo(15)" :disabled="busy">推进15分钟</button><button class="text-button" @click="modal={type:'reset'}" :disabled="busy">重置数据</button></div></section>
    <div class="page-heading"><div><div class="eyebrow green">{{isAdmin?'SPACE MANAGEMENT':'YOUR FOCUS STARTS HERE'}}</div><h1>{{titles[view]}}<span class="heading-dot">.</span></h1><p class="muted">{{view==='seats'?'选一处安静角落，开启今天的专注时光。':view==='mine'?'每一次预约，都是向目标靠近的一步。':view==='overview'?'了解空间使用情况，让每一个座位发挥价值。':'维护有序的学习空间，让预约与使用清晰可查。'}}</p></div><button v-if="view==='manage'" class="primary" @click="modal={type:'room'}"><Icon name="plus" :size="18"/>新建自习室</button><span v-else class="outline-tag"><Icon name="shield" :size="15"/>{{isAdmin?'管理员工作台':'文明预约 · 按时签到'}}</span></div>

    <template v-if="view==='seats'">
     <section class="welcome-banner"><div><span class="eyebrow">MAKE ROOM FOR YOUR NEXT IDEA</span><h2>一个座位，一段属于你的时间。</h2><p>提前规划，轻松入座。让好状态从这里发生。</p></div><div class="banner-mark"><Icon name="book" :size="74"/><span>READ · THINK · GROW</span></div></section>
     <div class="student-stats"><div><span class="stat-icon"><Icon name="book"/></span><div><small>开放自习室</small><strong>{{rooms.length}} <em>间</em></strong></div></div><div><span class="stat-icon"><Icon name="chair"/></span><div><small>当前选择可约座位</small><strong>{{bookable?available:0}} <em>个</em></strong></div></div><div><span class="stat-icon"><Icon name="calendar"/></span><div><small>我的有效预约</small><strong>{{ownActive.length}} <em>条</em></strong></div></div></div>
     <section class="panel booking-filters"><div class="section-title"><h3>选择你的学习计划</h3><span class="muted tiny">可预约未来 7 天</span></div><div class="date-strip"><button v-for="d in dates" :key="d.key" :class="{chosen:date===d.key}" @click="date=d.key"><span>{{d.title}}</span><strong>{{d.day}}</strong></button></div><div class="filter-bottom"><label class="inline-field"><span>自习室</span><select v-model.number="roomId"><option v-for="r in rooms" :key="r.id" :value="r.id">{{r.name}}</option></select></label><div class="slot-list"><button v-for="s in slots" :key="s.id" :class="{chosen:slotId===s.id}" @click="slotId=s.id">{{time(s.startTime)}}–{{time(s.endTime)}}</button></div></div></section>
     <div class="seat-layout"><section class="panel seat-panel"><div class="section-title"><div><h3>{{currentRoom?.name||'暂无开放自习室'}}</h3><p class="muted tiny location"><Icon name="pin" :size="14"/>{{currentRoom?.location}}</p></div><div class="legend"><span><i class="free"/>可预约</span><span><i class="occupied"/>已预约</span><span><i class="picked"/>已选择</span><span><i class="disabled"/>停用</span></div></div>
      <div class="front-label">前 方 · 请 保 持 安 静</div>
      <div v-if="seats.length" class="seat-map"><div v-for="row in seatRows" :key="row" class="seat-row"><span class="row-label">{{row}}</span><button v-for="s in seats.filter(s=>s.rowNo===row)" :key="s.id" class="seat" :class="{occupied:s.reservationId,disabled:!s.enabled,picked:selected?.id===s.id,mine:s.mine}" :disabled="!s.enabled||!!s.reservationId||!bookable||busy" @click="selected=s" :aria-label="'座位 '+s.code+(s.reservationId?' 已预约':!s.enabled?' 已停用':' 可预约')"><Icon name="chair" :size="23"/><strong>{{s.code}}</strong><span v-if="s.mine" class="seat-mine">本人</span><span v-else class="seat-features"><Icon v-if="s.hasPower" name="power" :size="10"/><Icon v-if="s.nearWindow" name="sun" :size="10"/></span></button></div></div><div v-else class="empty"><Icon name="chair" :size="36"/><p>当前没有可展示的座位</p></div>
      <p class="map-foot"><Icon name="info" :size="14"/>模拟座位状态每30秒刷新，数据仅保存在当前浏览器。</p>
     </section>
     <aside class="reservation-side"><section class="panel selection-card"><span class="eyebrow green">YOUR SELECTION</span><h3>预约信息</h3><div class="selected-seat">{{selected?.code||'—'}}<span>{{selected?'已选择座位':'点击左侧座位进行选择'}}</span></div><dl><dt>自习室</dt><dd>{{currentRoom?.name||'—'}}</dd><dt>预约日期</dt><dd>{{date}}</dd><dt>使用时段</dt><dd>{{time(currentSlot?.startTime)}}–{{time(currentSlot?.endTime)}}</dd><dt>座位设施</dt><dd>{{selected?[selected.hasPower?'有插座':'普通座位',selected.nearWindow?'临窗':''].filter(Boolean).join(' · '):'—'}}</dd></dl><button class="primary full" :disabled="!selected||busy||!bookable" @click="modal={type:'book'}">确认预约<Icon name="arrow" :size="18"/></button><p v-if="!bookable" class="tiny warning">该时段已结束或剩余不足15分钟，请选择其他时段。</p><p v-else class="tiny muted center">预约成功后，请在规定时间内签到。</p></section><section class="soft-note"><Icon name="clock" :size="21"/><div><h4>给专注一点仪式感</h4><p>提前预约须在时段开始后15分钟内签到；当前时段预约须在提交后15分钟内签到。</p></div></section></aside></div>
    </template>

    <template v-if="['mine','records'].includes(view)">
     <section v-if="view==='mine'&&ownActive.length" class="active-banner"><Icon name="calendar" :size="28"/><div><strong>你有 {{ownActive.length}} 条待使用或使用中的预约</strong><p>请留意每条预约的签到截止时间，避免座位被释放。</p></div></section>
     <section class="panel"><div class="table-toolbar"><div class="tabs"><button v-for="f in ['ALL','WAITING','CHECKED_IN','COMPLETED','CANCELLED','MISSED']" :key="f" :class="{chosen:filter===f}" @click="filter=f">{{f==='ALL'?'全部预约':label[f]}}</button></div><input class="search" v-model="keyword" placeholder="搜索座位、自习室或日期" aria-label="搜索预约"></div><div class="table-scroll"><table><thead><tr><th>预约位置</th><th v-if="isAdmin">预约人</th><th>日期与时段</th><th>状态</th><th>签到截止</th><th>操作</th></tr></thead><tbody><tr v-for="b in visibleBookings" :key="b.id"><td><strong>{{b.roomName}} · {{b.seatCode}}</strong><small>#{{String(b.id).padStart(5,'0')}}<span v-if="b.cancelReason"> · {{b.cancelReason}}</span></small></td><td v-if="isAdmin">{{b.displayName}}<small>{{b.username}}</small></td><td>{{b.bookingDate}}<small>{{time(b.startTime)}}–{{time(b.endTime)}}</small></td><td><span class="status" :class="b.status">{{label[b.status]}}</span></td><td>{{fmt(b.checkinDeadline)}}<small v-if="b.checkedInAt">签到 {{fmt(b.checkedInAt)}}</small></td><td><div class="row-actions"><button v-if="!isAdmin&&canCheckin(b)" class="primary small" :disabled="busy" @click="checkin(b)">立即签到</button><button v-if="isAdmin?['WAITING','CHECKED_IN'].includes(b.status):canCancel(b)" class="text-button" @click="askCancel(b)">取消预约</button><button v-if="!isAdmin&&b.status==='WAITING'&&now()<parseLocal(b.bookingDate+'T'+b.startTime)" class="text-button" :disabled="busy" @click="jumpToBooking(b)">演示：跳到签到时间</button><span v-if="!['WAITING','CHECKED_IN'].includes(b.status)" class="muted">—</span></div></td></tr></tbody></table></div><div v-if="!visibleBookings.length" class="empty"><Icon name="calendar" :size="38"/><h3>还没有相关预约</h3><p>{{isAdmin?'学生预约后，记录将在这里显示。':'为下一次专注，先预约一个座位吧。'}}</p><button v-if="!isAdmin" class="primary" @click="view='seats'">去预约座位<Icon name="arrow" :size="16"/></button></div><div class="table-footer">显示 {{visibleBookings.length}} 条记录 · 最多展示最近500条</div></section>
    </template>

    <template v-if="view==='overview'">
     <div class="metric-grid"><section class="panel metric" v-for="m in [{name:'今日预约',value:stats.total||0,icon:'calendar'},{name:'待签到',value:stats.waiting||0,icon:'clock'},{name:'正在使用',value:stats.checkedIn||0,icon:'chair'},{name:'今日失约',value:stats.missed||0,icon:'info'}]" :key="m.name"><span class="stat-icon"><Icon :name="m.icon"/></span><p>{{m.name}}</p><strong>{{m.value}}<small>条</small></strong></section></div>
     <div class="overview-grid"><section class="panel chart-panel"><div class="section-title"><h3>近7天预约趋势</h3><span class="outline-tag">本地模拟记录</span></div><div class="bar-chart"><div v-for="d in trend" :key="d.key"><strong>{{d.value}}</strong><div class="bar-track"><i :style="{height:(d.value/peak*100)+'%'}"/></div><span>{{d.key.slice(5)}}</span></div></div></section><section class="panel summary-card"><span class="eyebrow green">SPACE AT A GLANCE</span><h3>空间运行概况</h3><dl><dt>自习室数量</dt><dd>{{rooms.length}} 间</dd><dt>启用座位</dt><dd>{{stats.seatCount||0}} 个</dd><dt>今日曾签到</dt><dd>{{stats.attended||0}} 条</dd><dt>检查周期</dt><dd>操作时 / 30秒</dd></dl><p class="muted tiny">数据按预约日期统计。签到人数包含已完成和签到后取消的记录，便于核对实际签到行为。</p></section></div>
     <section class="panel"><div class="section-title"><h3>最近预约</h3><button class="text-button" @click="view='records'">查看全部 →</button></div><div class="recent-list"><div v-for="b in bookings.slice(0,5)" :key="b.id"><span class="stat-icon"><Icon name="chair"/></span><div><strong>{{b.displayName}} · {{b.roomName}} {{b.seatCode}}</strong><small>{{b.bookingDate}} {{time(b.startTime)}}–{{time(b.endTime)}}</small></div><span class="status" :class="b.status">{{label[b.status]}}</span></div></div><div v-if="!bookings.length" class="empty compact"><p>尚无预约数据，等待第一位使用者。</p></div></section>
    </template>

    <template v-if="view==='manage'">
     <section class="panel"><div class="section-title"><div><h3>自习室与座位</h3><p class="muted tiny">已有有效预约的座位须先处理预约，才能停用。</p></div><label class="inline-field"><select v-model.number="roomId"><option v-for="r in rooms" :key="r.id" :value="r.id">{{r.name}}{{r.enabled?'':'（已关闭）'}}</option></select></label></div><div v-if="currentRoom" class="room-summary"><div><strong>{{currentRoom.name}}</strong><p class="muted tiny">{{currentRoom.location}} · {{currentRoom.description}}</p></div><button class="secondary" :disabled="busy" @click="toggleRoom">{{currentRoom.enabled?'关闭自习室':'开放自习室'}}</button></div><div class="manage-seats"><div v-for="s in seats" :key="s.id" class="manage-seat" :class="{off:!s.enabled}"><Icon name="chair" :size="26"/><strong>{{s.code}}</strong><small>{{s.enabled?'已启用':'已停用'}}</small><button class="text-button" :disabled="busy" @click="toggleSeat(s)">{{s.enabled?'停用':'启用'}}</button></div></div><div v-if="!rooms.length" class="empty">请先新建自习室</div></section>
    </template>

    <section v-if="view==='logs'" class="panel"><div class="section-title"><h3>关键操作记录</h3><span class="muted tiny">最近200条 · 本地模拟操作留痕</span></div><div class="table-scroll"><table><thead><tr><th>时间</th><th>操作者</th><th>操作</th><th>对象编号</th><th>说明</th></tr></thead><tbody><tr v-for="l in logs" :key="l.id"><td>{{fmt(l.createdAt)}}</td><td>{{l.displayName||'系统任务'}}</td><td>{{({BOOK:'创建预约',CANCEL:'取消预约',CHECK_IN:'签到',MISSED:'超时失约',COMPLETED:'使用完成',SEAT_STATUS:'座位维护',ROOM_STATUS:'场地维护',CREATE_ROOM:'创建场地',DEMO_TIME:'演示调时'})[l.action]||l.action}}</td><td>#{{l.targetId}}</td><td>{{l.detail}}</td></tr></tbody></table></div><div v-if="!logs.length" class="empty">暂时没有操作记录</div></section>

    <section v-if="view==='guide'" class="panel guide"><span class="eyebrow green">A GUIDE TO BETTER STUDY</span><h2>预约有序，专注自在。</h2><div class="guide-grid"><article v-for="(g,i) in [{title:'选择时间与座位',text:'可预约今天及未来6天。同一时段每人仅能保留一个座位；当前时段剩余大于15分钟时可补约。'},{title:'在窗口内完成签到',text:'提前预约须在时段开始后15分钟内签到；当前时段预约从提交起计算15分钟。签到截止时刻不接受签到。'},{title:'及时取消，善用空间',text:'待签到且未超时的预约可取消。签到后首版不支持提前结束，管理员可因维护原因取消并留下说明。'},{title:'超时释放与自动结束',text:'未按时签到将被标记失约并释放座位。已签到的预约在时段结束后自动完成，历史记录始终保留。'},{title:'随时演示签到与失约',text:'初始演示时间为今天09:05。我的预约中可直接签到，也可跳到未来预约开始时间；推进15分钟可观察超时失约。演示时间只能向前推进。'},{title:'浏览器本地保存',text:'这里使用模拟账号和模拟数据，不连接后端。刷新后保留操作；不同访客数据独立。重置数据会恢复预置记录和今天09:05，仅影响当前浏览器。'}]" :key="i"><span class="guide-number">0{{i+1}}</span><h3>{{g.title}}</h3><p>{{g.text}}</p></article></div></section>
    <footer class="page-footer"><span>阅间 · 为每一份专注留出空间</span><span>纯前端模拟演示 · GitHub Pages</span></footer>
   </main>
  </div>
 </div>

 <div v-if="modal" class="modal-backdrop" @click.self="!busy&&(modal=null)"><section class="modal" role="dialog" aria-modal="true" :aria-label="({room:'新建自习室',book:'确认预约',cancel:'取消预约',demo:'调整演示时间',reset:'重置演示数据'})[modal.type]"><button class="icon-button modal-close" aria-label="关闭" :disabled="busy" @click="modal=null"><Icon name="close"/></button>
  <template v-if="modal.type==='book'"><span class="stat-icon large"><Icon name="calendar" :size="28"/></span><h2>为专注留个位置</h2><p class="muted">确认下列预约信息，准备开启学习时光。</p><div class="confirm-summary"><strong>{{currentRoom?.name}} · {{selected?.code}}</strong><p>{{date}} · {{time(currentSlot?.startTime)}}–{{time(currentSlot?.endTime)}}</p></div><p class="tiny muted">提前预约从时段开始起15分钟内签到；当前时段补约从提交起15分钟内签到。实际截止时间见预约记录。</p><button class="primary full" :disabled="busy" @click="confirmBooking">{{busy?'正在提交…':'确认预约'}}</button></template>
  <template v-if="modal.type==='cancel'"><h2>取消这次预约？</h2><p class="muted">{{modal.booking.roomName}} · {{modal.booking.seatCode}}<br>{{modal.booking.bookingDate}} {{time(modal.booking.startTime)}}–{{time(modal.booking.endTime)}}</p><form @submit.prevent="cancel"><label v-if="isAdmin">取消原因<textarea v-model.trim="reason" required maxlength="200" placeholder="填写维护或其他取消原因，学生可以看到"/></label><p v-else class="tiny muted">取消后座位将释放，你可以重新选择其他座位。</p><button class="primary full" :disabled="busy">确认取消预约</button></form></template>
  <template v-if="modal.type==='demo'"><span class="stat-icon large"><Icon name="clock" :size="28"/></span><h2>调整演示时间</h2><p class="muted">使用北京时间模拟业务流程。时间只向前推进，已失约或已完成的预约不会恢复；回到初始时间可重置数据。</p><form @submit.prevent="applyDemoTime"><label>演示日期与时间（北京时间）<input v-model="demoTime" type="datetime-local" required></label><button class="primary full" :disabled="busy">应用演示时间</button></form><div class="demo-modal-actions"><button class="secondary" :disabled="busy" @click="advanceDemo(15)">推进15分钟</button><button class="secondary" :disabled="busy" @click="advanceDemo(120)">推进2小时</button></div></template>
  <template v-if="modal.type==='reset'"><h2>重置演示数据？</h2><p class="muted">将清除当前浏览器中的演示操作，恢复2间自习室、48个座位及预置预约，时间回到今天09:05。当前登录账号保持不变。</p><p class="tiny muted">其他访客的浏览器数据不受影响。</p><button class="primary full" :disabled="busy" @click="resetDemo">确认重置演示数据</button></template>
  <template v-if="modal.type==='room'"><h2>新建自习室</h2><p class="muted">按行列自动生成座位，可在创建后逐个停用。</p><form @submit.prevent="addRoom"><label>自习室名称<input v-model.trim="newRoom.name" required maxlength="60"></label><label>位置<input v-model.trim="newRoom.location" required maxlength="120"></label><label>说明<textarea v-model.trim="newRoom.description" maxlength="300"/></label><div class="form-two"><label>座位行数<input v-model.number="newRoom.rows" type="number" min="1" max="10" required></label><label>每行座位数<input v-model.number="newRoom.columns" type="number" min="1" max="10" required></label></div><button class="primary full" :disabled="busy">创建 {{newRoom.rows*newRoom.columns}} 个座位</button></form></template>
 </section></div>
 <div class="toasts" aria-live="polite"><div v-for="n in notices" :key="n.id" class="toast" :class="n.type"><Icon :name="n.type==='error'?'info':'check'" :size="18"/>{{n.text}}<button @click="notices=notices.filter(x=>x.id!==n.id)" aria-label="关闭提示">×</button></div></div>
</template>

