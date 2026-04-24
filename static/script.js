const API_URL = "https://tiktok-dashboard-hano.onrender.com/data";

let chart;
let userChart;
let globalData = [];

// ================= 🧠 DETECT SPIKE =================
function detectSpikes(data){
  const avg = data.reduce((a,b)=>a+b,0) / (data.length || 1);
  return data.map(v => v > avg * 2 ? v : null);
}

async function fetchData(){
  const res = await fetch(API_URL);
  const data = await res.json();

  globalData = data;

  renderDashboard(data);
}

function renderDashboard(data){

  document.getElementById("totalChannels").innerText = data.length;

  const viral = data.filter(d => d.IsViral === "YES").length;
  document.getElementById("viralCount").innerText = viral;

  const best = data.reduce((a,b)=> a.Score > b.Score ? a : b);
  document.getElementById("bestChannel").innerText = best.Username;

  renderTop(data);
  renderTable(data);
  renderChart(data);
}

function renderTop(data){

  const top = [...data]
    .sort((a,b)=> b.ViewGrowth - a.ViewGrowth)
    .slice(0,10);

  const ul = document.getElementById("topList");
  ul.innerHTML = "";

  top.forEach(d=>{
    ul.innerHTML += `<li>${d.Username} (+${d.ViewGrowth})</li>`;
  });
}

function formatGrowth(v){
  if(v>0) return `<span style="color:lime">+${v}</span>`;
  if(v<0) return `<span style="color:red">${v}</span>`;
  return v;
}

function renderTable(data){
  const tbody=document.getElementById("tableBody");
  tbody.innerHTML="";

  data.forEach(d=>{
    tbody.innerHTML+=`
    <tr>
      <td onclick="openUser('${d.Username}')" style="cursor:pointer;color:#38bdf8">${d.Username}</td>
      <td>${d.Followers}</td>
      <td>${d.Likes}</td>
      <td>${d.TotalViews}</td>
      <td>${formatGrowth(Number(d.ViewGrowth))}</td>
      <td>${d.Score}</td>
      <td>${d.ChannelStatus}</td>
    </tr>`;
  });
}

// ================= MAIN CHART (ZOOM + SPIKE) =================
function renderChart(data){

  const ctx=document.getElementById("mainChart").getContext("2d");

  if(chart) chart.destroy();

  const views = data.map(d=>Number(d.TotalViews));
  const growth = data.map(d=>Number(d.ViewGrowth));
  const spikes = detectSpikes(growth);

  chart=new Chart(ctx,{
    data:{
      labels:data.map(d=>d.Username),
      datasets:[
        {
          type:'bar',
          label:'Views',
          data:views
        },
        {
          type:'line',
          label:'Growth',
          data:growth,
          tension:0.3
        },
        {
          type:'scatter',
          label:'🔥 Spike',
          data:spikes,
          pointRadius:6,
          pointBackgroundColor:'red'
        }
      ]
    },
    options:{
      responsive:true,
      plugins:{
        tooltip:{
          backgroundColor:"#111",
          titleColor:"#fff",
          bodyColor:"#0f0",
          borderColor:"#555",
          borderWidth:1,
          callbacks:{
            label:(ctx)=>`${ctx.dataset.label}: ${ctx.raw?.toLocaleString?.() || ctx.raw}`
          }
        },
        zoom:{
          pan:{enabled:true,mode:'x'},
          zoom:{
            drag:{
              enabled:true,
              backgroundColor:'rgba(0,255,255,0.2)'
            },
            wheel:{enabled:true},
            mode:'x'
          }
        }
      }
    }
  });
}

// ================= SEARCH =================
document.addEventListener("DOMContentLoaded", ()=>{
  const input = document.getElementById("searchInput");

  input.addEventListener("input", e=>{
    const keyword = e.target.value.toLowerCase();

    const filtered = globalData.filter(d =>
      d.Username.toLowerCase().includes(keyword)
    );

    renderTable(filtered);
    renderChart(filtered);
  });
});

// ================= GROUP BY DAY =================
function groupByDay(labels, values){

  const map = {};

  labels.forEach((d, i)=>{
    if(!d) return;

    const day = new Date(d).toISOString().split("T")[0];

    if(!map[day]) map[day] = 0;
    map[day] += Number(values[i]) || 0;
  });

  return {
    labels: Object.keys(map),
    values: Object.values(map)
  };
}
// ================= USER DETAIL =================
async function openUser(username){

  document.getElementById("userModal").style.display="block";
  document.getElementById("modalTitle").innerText=username;

  const res = await fetch(API_URL.replace("/data","/api/history"));
  const history = await res.json();

  const userData = history.filter(d => d.Username === username);

  if(!userData.length){
    console.log("No history data");
    return;
  }

  // sort theo thời gian
  userData.sort((a,b)=> new Date(a.LastUpdate) - new Date(b.LastUpdate));

  const labels = userData.map(d => new Date(d.LastUpdate));
  const views = userData.map(d => Number(d.TotalViews) || 0);
  const growth = userData.map(d => Number(d.ViewGrowth) || 0);

  console.log("DEBUG:", userData);

  renderUserChart(labels, views, growth);
}

// ================= USER CHART =================
function renderUserChart(labels,views,growth){

  // ✅ DEBUG ĐẶT Ở ĐÂY
  console.log("LABELS:", labels);
  console.log("VIEWS:", views);
  console.log("GROWTH:", growth);

  const ctx=document.getElementById("userChart").getContext("2d");

  if(userChart) userChart.destroy();

  const v = groupByDay(labels, views);
  const g = groupByDay(labels, growth);

  const spikes = detectSpikes(g.values);

  userChart=new Chart(ctx,{
    data:{
      labels:v.labels,
      datasets:[
        {
          type:'bar',
          label:'Views',
          data:v.values
        },
        {
          type:'line',
          label:'Growth',
          data:g.values,
          tension:0.4
        },
        {
          type:'scatter',
          label:'🔥 Spike',
          data:spikes,
          pointRadius:6,
          pointBackgroundColor:'red'
        }
      ]
    },
    options:{
      responsive:true,
      plugins:{
        zoom:{
          pan:{enabled:true,mode:'x'},
          zoom:{
            drag:{enabled:true},
            wheel:{enabled:true},
            mode:'x'
          }
        }
      }
    }
  });
}
function closeModal(){
  document.getElementById("userModal").style.display="none";
}

// ================= RESET ZOOM =================
document.addEventListener("dblclick", ()=>{
  if(chart) chart.resetZoom();
  if(userChart) userChart.resetZoom();
});

fetchData();
setInterval(fetchData,60000);