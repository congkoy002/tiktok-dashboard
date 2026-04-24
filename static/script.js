const API_URL = "https://tiktok-dashboard-hano.onrender.com/data";

let chart;
let userChart;

async function fetchData(){
  const res = await fetch(API_URL);
  const data = await res.json();
  renderDashboard(data);
}

function renderDashboard(data){

  document.getElementById("totalChannels").innerText = data.length;

  const viral = data.filter(d => d.IsViral === "YES").length;
  document.getElementById("viralCount").innerText = viral;

  const best = data.reduce((a,b)=> a.Score > b.Score ? a : b);
  document.getElementById("bestChannel").innerText = best.Username;

  renderTable(data);
  renderChart(data);
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

function renderChart(data){

  const ctx=document.getElementById("mainChart").getContext("2d");

  if(chart) chart.destroy();

  chart=new Chart(ctx,{
    data:{
      labels:data.map(d=>d.Username),
      datasets:[
        {type:'bar',label:'Views',data:data.map(d=>Number(d.TotalViews))},
        {type:'line',label:'Growth',data:data.map(d=>Number(d.ViewGrowth))}
      ]
    }
  });
}

async function openUser(username){

  document.getElementById("userModal").style.display="block";
  document.getElementById("modalTitle").innerText=username;

  const res=await fetch(API_URL.replace("/data","/api/history"));
  const history=await res.json();

  const userData=history.filter(r=>r[0]===username);

  const labels=userData.map(r=>r[16]);
  const views=userData.map(r=>Number(r[5]));
  const growth=userData.map(r=>Number(r[10]));

  renderUserChart(labels,views,growth);
}

function renderUserChart(labels,views,growth){

  const ctx=document.getElementById("userChart").getContext("2d");

  if(userChart) userChart.destroy();

  userChart=new Chart(ctx,{
    data:{
      labels,
      datasets:[
        {type:'line',label:'Views',data:views},
        {type:'line',label:'Growth',data:growth}
      ]
    }
  });
}

function closeModal(){
  document.getElementById("userModal").style.display="none";
}

fetchData();
setInterval(fetchData,60000);