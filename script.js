// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDrbD5MPUQToGAt9dcNy2U3-IeIakAB9I4",
  authDomain: "j3-placar.firebaseapp.com",
  databaseURL: "https://j3-placar-default-rtdb.firebaseio.com",
  projectId: "j3-placar",
  storageBucket: "j3-placar.firebasestorage.app",
  messagingSenderId: "440209134387",
  appId: "1:440209134387:web:98df5b4e2823519a7c6446"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let isAdmin = false;
let editingId = null; 
let rankMemory = {};
let cachedUsers = []; 

// --- AUTH SYSTEM ---
auth.onAuthStateChanged(async (user) => {
    const path = window.location.pathname;
    const btnLoginNav = document.getElementById('btn-login-nav');
    const btnLogout = document.getElementById('btnLogout');
    const magicLock = document.getElementById('magic-lock');

    if (user) {
        currentUser = user;
        // UI para Logado
        if(btnLoginNav) btnLoginNav.classList.add('hidden');
        if(btnLogout) btnLogout.classList.remove('hidden');
        if(magicLock) magicLock.classList.remove('hidden');

        try {
            const s = await db.ref('users/' + user.uid).once('value');
            if (s.val() && s.val().isAdmin) {
                isAdmin = true;
                document.body.classList.add('is-admin');
                
                // Libera funcionalidades Admin
                const btnRev = document.getElementById('btn-reveal-podium');
                if(btnRev) btnRev.classList.remove('hidden');
                
                const adminPanel = document.getElementById('admin-panel');
                if(adminPanel) adminPanel.style.display = 'block';
                
                const danger = document.getElementById('danger-zone');
                if(danger) danger.classList.remove('hidden');
            }
        } catch(e){ console.error(e); }
    } else {
        // UI para Não Logado (Visitante)
        if(btnLoginNav) btnLoginNav.classList.remove('hidden');
        if(btnLogout) btnLogout.classList.add('hidden');
        if(magicLock) magicLock.classList.add('hidden');
    }

    if (path.includes('index.html') || path === '/') initIndex();
    if (path.includes('tabela.html')) initTabela();
});

// Logout
const btnLogout = document.getElementById('btnLogout');
if(btnLogout) btnLogout.addEventListener('click', () => {
    auth.signOut().then(() => location.reload());
});

// Cadeado Mágico
const lock = document.getElementById('magic-lock');
if(lock) lock.addEventListener('click', async () => {
    if(!currentUser) return alert("Faça login primeiro (como usuário comum).");
    const pwd = prompt("Senha Mestra:");
    if(pwd==="adminj3") {
        await db.ref('users/'+currentUser.uid).update({isAdmin:true});
        alert("Modo Juiz Ativado!");
        location.reload();
    } else {
        alert("Senha errada.");
    }
});

// --- INDEX.HTML ---
function initIndex() {
    db.ref('users').on('value', uSnap => {
        db.ref('activities').on('value', aSnap => {
            let j = 0, r = 0;
            const acts = [];
            const ranking = [];

            uSnap.forEach(c => {
                const u = {key:c.key, ...c.val()};
                if(u.inRanking) {
                    ranking.push(u);
                    const p = parseInt(u.pts||0);
                    if(u.team==='juda') j+=p;
                    if(u.team==='reman') r+=p;
                }
            });

            aSnap.forEach(c => {
                const a = c.val();
                acts.push(a);
                const p = parseInt(a.points||0);
                if(a.team==='juda'||a.team==='both') j+=p;
                if(a.team==='reman'||a.team==='both') r+=p;
            });

            const elJ = document.getElementById('score-juda');
            const elR = document.getElementById('score-reman');
            if(elJ) elJ.innerText = j;
            if(elR) elR.innerText = r;
            
            renderHistory(acts.reverse());
            renderPodiumSidebar(ranking);
        });
    });

    const btnSend = document.getElementById('btn-send-score');
    if(btnSend) {
        let selTeam = null;
        document.querySelectorAll('.radio-team').forEach(el => {
            el.addEventListener('click', function(){
                document.querySelectorAll('.radio-team').forEach(d=>d.className='radio-team');
                this.classList.add(this.dataset.value==='juda'?'selected-juda':(this.dataset.value==='reman'?'selected-reman':'selected-both'));
                selTeam = this.dataset.value;
            });
        });

        btnSend.addEventListener('click', () => {
            const n = document.getElementById('act-name').value;
            const p = parseInt(document.getElementById('act-pts').value);
            const o = document.getElementById('act-obs').value;
            if(!n || isNaN(p) || !selTeam) return alert("Preencha tudo");
            db.ref('activities').push({name:n, points:p, team:selTeam, obs:o||"-", timestamp: Date.now()});
            alert("Enviado!");
            document.getElementById('act-name').value='';
            document.getElementById('act-pts').value='';
            document.getElementById('act-obs').value='';
        });
    }

    const btnReset = document.getElementById('btn-reset');
    const btnEnd = document.getElementById('btn-end');
    if(btnReset) btnReset.addEventListener('click', resetGame);
    if(btnEnd) btnEnd.addEventListener('click', endGame);
}

// --- TABELA.HTML ---
function initTabela() {
    const fileIn = document.getElementById('file-input');
    const nameIn = document.getElementById('inp-name');
    const teamIn = document.getElementById('inp-team');
    const btnSave = document.getElementById('btn-save');
    const btnCancel = document.getElementById('btn-cancel');
    const prevImg = document.getElementById('preview-img');
    const lblImg = document.getElementById('label-img');

    if(fileIn) {
        fileIn.addEventListener('change', function(){
            if(this.files[0]) {
                const r = new FileReader();
                r.onload = e => { prevImg.src=e.target.result; prevImg.style.display='block'; lblImg.style.display='none'; };
                r.readAsDataURL(this.files[0]);
            }
        });
    }

    if(btnCancel) {
        btnCancel.addEventListener('click', () => {
            editingId = null; nameIn.value=''; teamIn.value=''; fileIn.value='';
            prevImg.style.display='none'; lblImg.style.display='block';
            document.getElementById('form-title').innerText="➕ Adicionar Participante";
            btnSave.innerText="SALVAR"; btnSave.style.background="var(--juda-color)";
            btnCancel.classList.add('hidden');
        });
    }

    if(btnSave) {
        btnSave.addEventListener('click', async () => {
            const n=nameIn.value, t=teamIn.value, f=fileIn?fileIn.files[0]:null;
            if(!n||!t) return alert("Preencha tudo");
            let av = null;
            if(f) av = await toBase64(f);
            else if(!editingId) av=`https://ui-avatars.com/api/?name=${n}&background=333&color=fff`;
            const p={name:n, team:t, inRanking:true};
            if(av) p.avatar=av;
            if(editingId) { await db.ref('users/'+editingId).update(p); alert("Editado!"); btnCancel.click(); } 
            else { p.pts=0; p.pe=0; await db.ref('users').push(p); alert("Criado!"); btnCancel.click(); }
        });
    }

    db.ref('users').on('value', snap => {
        const tb = document.querySelector('#ranking-table tbody');
        if(!tb) return;
        const list = [];
        snap.forEach(c => {
            const u = {key:c.key, ...c.val()};
            if(!u.name || u.name === "undefined") u.name = "Sem Nome";
            if(u.inRanking) list.push(u);
        });
        
        list.sort((a,b)=>(b.pts||0)-(a.pts||0));
        cachedUsers = list;
        tb.innerHTML = '';
        if(list.length === 0) tb.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Nenhum participante.</td></tr>';

        list.forEach((u, i) => {
            const r = i+1;
            let arrow = '<span class="trend-equal">-</span>';
            if(rankMemory[u.key]) {
                if(r < rankMemory[u.key]) arrow = '<span class="trend-up">▲</span>';
                else if(r > rankMemory[u.key]) arrow = '<span class="trend-down">▼</span>';
            }
            setTimeout(()=> rankMemory[u.key] = r, 0);

            let pe = `<span style="opacity:0.5">${u.pe||0}</span>`, acts='';
            if(isAdmin) {
                pe = `<button class="btn-mini" style="background:rgba(255,255,255,0.1)" onclick="updPE('${u.key}', -1)">-</button>
                      <span style="font-weight:bold; margin:0 5px;">${u.pe||0}</span>
                      <button class="btn-mini" style="background:var(--success); color:#000" onclick="updPE('${u.key}', 1)">+</button>`;
                acts = `<div class="action-group">
                        <button class="btn-mini" style="background:#ff9f0a; color:#000" onclick="editUser('${u.key}', '${u.name}', '${u.team}', '${u.avatar}')">✏️</button>
                        <button class="btn-mini" style="background:#ff453a; color:#fff" onclick="delUser('${u.key}')">🗑</button>
                        </div>`;
            }
            const c = u.team==='juda'?'var(--juda-color)':'var(--reman-color)';
            tb.innerHTML += `<tr><td style="text-align:center;font-weight:bold;color:#666">${r}º</td><td>${arrow}</td><td style="display:flex;align-items:center;gap:10px"><img src="${u.avatar}" style="width:34px;height:34px;border-radius:50%;border:2px solid ${c};object-fit:cover;"><div><div style="font-weight:bold;font-size:14px">${u.name}</div><div style="font-size:10px;opacity:0.6">${u.team}</div></div></td><td><div class="pe-control">${pe}</div></td><td style="text-align:right;font-weight:bold;font-size:16px;">${u.pts||0}</td><td>${acts}</td></tr>`;
        });
    });

    const btnRev = document.getElementById('btn-reveal-podium');
    if(btnRev) {
        btnRev.addEventListener('click', () => {
            if(cachedUsers.length < 3) return alert("Precisa de pelo menos 3 participantes.");
            const overlay = document.getElementById('overlay-screen');
            const cd = document.getElementById('countdown-number');
            const podSection = document.getElementById('final-podium');
            podSection.style.display = 'none'; overlay.style.display = 'flex';
            const top3 = cachedUsers.slice(0, 3);
            const fillCard = (id, user, rank) => {
                const el = document.getElementById(id);
                const color = user.team==='juda'?'var(--juda-color)':'var(--reman-color)';
                el.innerHTML = `<div class="p-rank">${rank}</div><img src="${user.avatar}" class="p-avatar" style="border-color:${color}"><div class="p-name" style="color:${color}">${user.name}</div><div class="p-score">${user.pts} PTS</div>`;
            };
            fillCard('pod-1', top3[0], 1); fillCard('pod-2', top3[1], 2); fillCard('pod-3', top3[2], 3);
            let count = 5; cd.innerText = count;
            const timer = setInterval(() => { count--; if(count > 0) cd.innerText = count; else { clearInterval(timer); overlay.style.display = 'none'; podSection.style.display = 'flex'; runConfetti(); } }, 1000);
        });
    }
}

// --- FUNÇÕES GLOBAIS ---
window.cleanGhosts = function() {
    db.ref('users').once('value', s => {
        s.forEach(c => {
            const u = c.val();
            if(!u.name || u.name === "undefined") { console.log("Removendo:", c.key); db.ref('users/'+c.key).remove(); }
        });
        alert("Limpeza feita!");
    });
};
window.updPE = async (k,d) => { let s=await db.ref('users/'+k).once('value'); let pe=(s.val().pe||0)+d, pts=(s.val().pts||0)+(d*10); if(pe>=0) db.ref('users/'+k).update({pe,pts}); };
window.delUser = (k) => { if(confirm("Excluir?")) { delete rankMemory[k]; db.ref('users/'+k).remove(); } };
window.editUser = (k,n,t,a) => {
    editingId=k; document.getElementById('inp-name').value=n; document.getElementById('inp-team').value=t;
    const img=document.getElementById('preview-img'); img.src=a; img.style.display='block'; document.getElementById('label-img').style.display='none';
    document.getElementById('form-title').innerText="✏️ Editar"; document.getElementById('btn-save').innerText="SALVAR";
    document.getElementById('btn-save').style.background="#ff9f0a"; document.getElementById('btn-cancel').classList.remove('hidden');
    window.scrollTo({top:0, behavior:'smooth'});
};
function resetGame() { if(!confirm("⚠ RESETAR TUDO?")) return; if(prompt("Senha:")!=="adminj3") return; db.ref('activities').remove(); db.ref('users').once('value', s=>{ const u={}; s.forEach(c=>{u[`users/${c.key}/pts`]=0; u[`users/${c.key}/pe`]=0;}); db.ref().update(u); }); alert("Reiniciado!"); }
function endGame(){ if(!confirm("ENCERRAR JOGO?")) return; const j=parseInt(document.getElementById('score-juda').innerText); const r=parseInt(document.getElementById('score-reman').innerText); const ov=document.getElementById('overlay-screen'); const cd=document.getElementById('countdown-number'); const ch=document.getElementById('champion-display'); ov.style.display='flex'; let n=15; cd.innerText=n; const i=setInterval(()=>{ n--; if(n>0)cd.innerText=n; else{ clearInterval(i); cd.style.display='none'; ch.classList.remove('hidden'); const nm=document.getElementById('champ-name'), lg=document.getElementById('champ-logo'), sc=document.getElementById('champ-score'); if(j>r){nm.innerText="JUDÁ";nm.style.color="var(--juda-color)";lg.src="https://i.imgur.com/u7y7q5x.png";sc.innerText=j+" PTS";} else if(r>j){nm.innerText="REMANESCENTES";nm.style.color="var(--reman-color)";lg.src="https://i.imgur.com/8Qj8j9x.png";sc.innerText=r+" PTS";} else{nm.innerText="EMPATE";lg.style.display='none';sc.innerText=j+" a "+r;} runConfetti(); } },1000); }
function renderHistory(l){ const t=document.querySelector('#history-table tbody'); if(!t)return; t.innerHTML=l.length?'':'<tr><td colspan="3" style="text-align:center">Vazio</td></tr>'; l.forEach(x=>{ let cls=x.team==='both'?'bg-both':(x.team==='juda'?'bg-juda':'bg-reman'); let txt=x.team==='both'?'AMBAS':(x.team==='juda'?'JUDÁ':'REMAN'); let clr=x.points>=0?'var(--success)':'var(--danger)'; t.innerHTML+=`<tr><td><b>${x.name}</b><br><span style="font-size:10px;opacity:0.6">${x.obs}</span></td><td><span style="padding:4px;border-radius:4px;font-size:10px;font-weight:bold" class="${cls}">${txt}</span></td><td style="text-align:right;color:${clr};font-weight:bold">${x.points}</td></tr>`; }); }
function renderPodiumSidebar(l){ const u=document.getElementById('podium-list'); if(!u)return; u.innerHTML=''; l.sort((a,b)=>(b.pts||0)-(a.pts||0)); l.slice(0,3).forEach((x,i)=>{ let c=x.team==='juda'?'var(--juda-color)':'var(--reman-color)'; u.innerHTML+=`<li style="display:flex;align-items:center;padding:10px;border-bottom:1px solid rgba(255,255,255,0.1)"><div style="width:24px;height:24px;background:#333;border-radius:50%;display:flex;justify-content:center;align-items:center;margin-right:10px;font-weight:bold;font-size:12px">${i+1}</div><img src="${x.avatar}" style="width:30px;height:30px;border-radius:50%;border:2px solid ${c};margin-right:10px"><div><div style="font-weight:bold;font-size:14px">${x.name}</div><div style="font-size:11px;opacity:0.6">${x.pts} pts</div></div></li>`; }); }
function runConfetti(){const d=3000,e=Date.now()+d;(function f(){confetti({particleCount:5,spread:70,origin:{y:0.6}});if(Date.now()<e)requestAnimationFrame(f);}());}
const toBase64=f=>new Promise((r,j)=>{const d=new FileReader();d.readAsDataURL(f);d.onload=()=>r(d.result);d.onerror=j;});

// --- LIGAÇÃO COM LOGIN/REGISTRO (Para a página login.html) ---
if(document.getElementById('form-login')) {
    const fLogin = document.getElementById('form-login');
    const fReg = document.getElementById('form-register');
    fLogin.addEventListener('submit', (e) => { e.preventDefault(); auth.signInWithEmailAndPassword(document.getElementById('log-email').value, document.getElementById('log-pass').value).catch(e=>alert(e.message)); });
    fReg.addEventListener('submit', async (e) => { e.preventDefault(); const n=document.getElementById('reg-name').value, em=document.getElementById('reg-email').value, p=document.getElementById('reg-pass').value, t=document.getElementById('reg-team').value, f=document.getElementById('reg-file').files[0]; try { let av=`https://ui-avatars.com/api/?name=${n}&background=333&color=fff`; if(f) av=await toBase64(f); const c=await auth.createUserWithEmailAndPassword(em,p); await db.ref('users/'+c.user.uid).set({name:n, email:em, team:t, avatar:av, isAdmin:false, inRanking:false, pe:0, pts:0, createdAt: firebase.database.ServerValue.TIMESTAMP}); window.location.href='index.html'; } catch(err){alert(err.message);} });
}