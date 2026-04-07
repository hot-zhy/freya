(function(){
  var HASH='93df2cf3bc14e94af2ec9cef6651d37ea93736cb24b37388024daa1d046ec30c';
  var KEY='_mock_auth';
  if(sessionStorage.getItem(KEY)===HASH){show();return;}
  var overlay=document.getElementById('auth-gate');
  overlay.style.display='flex';
  document.getElementById('auth-btn').onclick=verify;
  document.getElementById('auth-pwd').onkeydown=function(e){if(e.key==='Enter')verify();};
  async function sha256(msg){
    var buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(msg));
    return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }
  async function verify(){
    var pwd=document.getElementById('auth-pwd').value;
    var h=await sha256(pwd);
    if(h===HASH){sessionStorage.setItem(KEY,HASH);show();overlay.style.display='none';}
    else{document.getElementById('auth-err').textContent='密码错误，请重试';document.getElementById('auth-pwd').value='';document.getElementById('auth-pwd').focus();}
  }
  function show(){document.getElementById('auth-gate').style.display='none';document.getElementById('main-content').style.display='block';}
})();
