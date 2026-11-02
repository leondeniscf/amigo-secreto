/* Amigo Secreto · tudo no aparelho do organizador. O segredo de cada pessoa vive só no QR dela. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const BASE = location.origin + location.pathname;

  let toastTimer;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600); }

  const LS = {
    get(k, d) { try { const v = localStorage.getItem("amigo:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("amigo:" + k, JSON.stringify(v)); } catch { toast("Não consegui salvar"); } },
  };

  // ---------- base64url + cifra (AES-GCM, chave dentro do próprio QR) ----------
  const b64u = {
    enc: (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    dec: (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
  };
  const utf8 = { enc: (s) => new TextEncoder().encode(s), dec: (b) => new TextDecoder().decode(b) };
  async function seal(obj) {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 128 }, true, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8.enc(JSON.stringify(obj))));
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    return `${b64u.enc(raw)}.${b64u.enc(iv)}.${b64u.enc(ct)}`;
  }
  async function unseal(token) {
    const [k, iv, ct] = token.split(".");
    const key = await crypto.subtle.importKey("raw", b64u.dec(k), { name: "AES-GCM" }, false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64u.dec(iv) }, key, b64u.dec(ct));
    return JSON.parse(utf8.dec(pt));
  }
  const packSetup = (obj) => b64u.enc(utf8.enc(JSON.stringify(obj)));
  const unpackSetup = (s) => JSON.parse(utf8.dec(b64u.dec(s)));

  // ---------- estado ----------
  const State = {
    event() { return LS.get("event", { title: "", date: "", value: "", noFamily: true }); },
    people() { return LS.get("people", []); },
    draw() { return LS.get("draw", null); },
  };

  // ---------- navegação ----------
  const views = $$(".view");
  function go(name) {
    views.forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    window.scrollTo(0, 0);
    if (name === "org") Org.render();
    if (name === "list") List.render();
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); });

  // ---------- organizador ----------
  const FAM_COLORS = ["#b3261e", "#1f3d2b", "#c9a227", "#2f6fd6", "#8b4fc2", "#f07f1d", "#3aa655", "#d9743a"];
  const Org = {
    render() {
      const ev = State.event(), people = State.people(), draw = State.draw();
      $("#ev-title").value = ev.title; $("#ev-date").value = ev.date; $("#ev-value").value = ev.value; $("#ev-family").checked = ev.noFamily !== false;
      $("#org-title").textContent = ev.title || "Amigo Secreto";
      const fams = [...new Set(people.map((p) => p.family).filter(Boolean))];
      $("#families").innerHTML = fams.map((f) => `<option value="${esc(f)}">`).join("");
      $("#p-resp").innerHTML = `<option value="">Adulto (escaneia o próprio QR)</option>` + people.filter((p) => !p.resp).map((p) => `<option value="${p.id}">Criança · responsável: ${esc(p.name)}</option>`).join("");
      $("#p-count").textContent = people.length ? `${people.length}` : "";
      const color = (f) => FAM_COLORS[Math.max(0, fams.indexOf(f)) % FAM_COLORS.length];
      $("#plist").innerHTML = people.map((p) => {
        const r = people.find((x) => x.id === p.resp);
        return `<div class="p-item"><span class="fam-tag" style="background:${color(p.family)}"></span>
          <span><span class="pn">${esc(p.name)}</span> <span class="pf">${esc(p.family || "")}</span>${r ? `<br><span class="pk">criança · com ${esc(r.name)}</span>` : ""}</span>
          <button class="del" data-del="${p.id}" aria-label="Remover">×</button></div>`;
      }).join("") || `<p class="hint">Ninguém ainda. Adicione os participantes ou abra o link de configuração.</p>`;
      $("#draw").disabled = people.length < 3 || !!draw;
      $("#draw").textContent = draw ? "Sorteio feito ✓" : "🎲 Sortear";
      $("#result-card").hidden = !draw;
      if (draw) $("#result-when").textContent = new Date(draw.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      if (draw && !this._boardFor || (draw && this._boardFor !== draw.at)) { this._boardFor = draw?.at; Board.render(); }
      if (!draw) $("#board").hidden = true;
    },
    saveEvent() {
      LS.set("event", { title: $("#ev-title").value.trim(), date: $("#ev-date").value, value: $("#ev-value").value.trim(), noFamily: $("#ev-family").checked });
      $("#org-title").textContent = $("#ev-title").value.trim() || "Amigo Secreto";
    },
  };
  ["#ev-title", "#ev-date", "#ev-value", "#ev-family"].forEach((s) => $(s).addEventListener("change", () => Org.saveEvent()));
  $("#p-add").addEventListener("click", () => {
    const name = $("#p-name").value.trim(), family = $("#p-family").value.trim(), resp = $("#p-resp").value;
    if (!name) return toast("Escreva o nome");
    if (State.draw()) return toast("Refaça o sorteio para mudar a lista");
    const people = State.people();
    if (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) return toast("Esse nome já está na lista");
    const respP = people.find((p) => p.id === resp);
    people.push({ id: uid(), name, family: family || (respP ? respP.family : ""), resp: resp || null });
    LS.set("people", people);
    $("#p-name").value = ""; $("#p-resp").value = "";
    Org.render(); $("#p-name").focus();
  });
  $("#p-name").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#p-add").click(); });
  $("#plist").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    if (State.draw()) return toast("Refaça o sorteio para mudar a lista");
    const people = State.people().filter((p) => p.id !== b.dataset.del && p.resp !== b.dataset.del);
    LS.set("people", people); Org.render();
  });

  // ---------- sorteio ----------
  function makeDraw(people, noFamily) {
    // regras: ninguém tira a si mesmo; opcionalmente ninguém tira da própria família;
    // responsável não tira a criança que representa e a criança não tira o responsável (já coberto pela família, mas garantido aqui).
    const ok = (g, r) => g.id !== r.id && !(noFamily && g.family && g.family === r.family) && g.resp !== r.id && r.resp !== g.id;
    for (let attempt = 0; attempt < 5000; attempt++) {
      const receivers = people.slice().sort(() => Math.random() - 0.5);
      const pairs = []; const used = new Set(); let fail = false;
      // atribui na ordem dos que têm menos opções
      const givers = people.slice().sort((a, b) => people.filter((r) => ok(a, r)).length - people.filter((r) => ok(b, r)).length);
      for (const g of givers) {
        const cand = receivers.filter((r) => !used.has(r.id) && ok(g, r));
        if (!cand.length) { fail = true; break; }
        const r = cand[Math.floor(Math.random() * cand.length)];
        used.add(r.id); pairs.push([g.id, r.id]);
      }
      if (!fail) return pairs;
    }
    return null;
  }
  $("#draw").addEventListener("click", async () => {
    Org.saveEvent();
    const people = State.people(), ev = State.event();
    const pairs = makeDraw(people, ev.noFamily !== false);
    if (!pairs) return toast("Não há combinação possível com essas regras. Desmarque a regra de família ou ajuste a lista.");
    const byId = Object.fromEntries(people.map((p) => [p.id, p]));
    const secret = b64u.enc(crypto.getRandomValues(new Uint8Array(16)));
    const items = [];
    for (const [g, r] of pairs) {
      const giver = byId[g], recv = byId[r];
      const resp = giver.resp ? byId[giver.resp] : null;
      const token = await seal({ g: giver.name, r: recv.name, rf: recv.family || "", resp: resp?.name || "", s: secret, ev: { title: ev.title, date: ev.date, value: ev.value } });
      items.push({ id: giver.id, name: giver.name, resp: resp?.name || "", url: `${BASE}#t=${token}` });
    }
    // ordem de apresentação: responsável seguido das crianças dele
    const order = [];
    for (const p of people) { if (p.resp) continue; order.push(p.id); people.filter((c) => c.resp === p.id).forEach((c) => order.push(c.id)); }
    items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    LS.set("draw", { at: Date.now(), secret, items });
    toast("Sorteio feito. Você não vê o resultado: só quem escanear.");
    Org.render();
  });
  $("#redraw").addEventListener("click", () => {
    if (!confirm("Refazer o sorteio? Os QRs já mostrados deixam de valer.")) return;
    LS.set("draw", null); Org.render();
  });
  $("#share-setup").addEventListener("click", async () => {
    const link = `${BASE}#setup=${packSetup({ event: State.event(), people: State.people() })}`;
    try { await navigator.clipboard.writeText(link); toast("Link copiado. Abra em outro aparelho para carregar a mesma lista."); }
    catch { prompt("Copie o link:", link); }
  });

  // ---------- mostrar um por um ----------
  const Show = {
    i: 0,
    async render() {
      const d = State.draw(); if (!d) return go("org");
      const it = d.items[this.i];
      $("#show-counter").textContent = `${this.i + 1} de ${d.items.length}`;
      $("#show-name").textContent = it.name;
      $("#show-resp").textContent = it.resp ? `criança · quem escaneia é ${it.resp}` : "";
      $("#show-qr").innerHTML = await QRCode.toString(it.url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#1f2a22", light: "#ffffff" } });
      $("#show-prev").disabled = this.i === 0;
      $("#show-next").textContent = this.i === d.items.length - 1 ? "Terminar ✓" : "Próximo ›";
    },
  };
  $("#show-start").addEventListener("click", () => { Show.i = 0; go("show"); Show.render(); });
  $("#show-prev").addEventListener("click", () => { if (Show.i > 0) { Show.i--; Show.render(); } });
  $("#show-next").addEventListener("click", () => {
    const d = State.draw();
    if (Show.i >= d.items.length - 1) { go("org"); toast("Todos os QRs mostrados."); return; }
    Show.i++; Show.render();
  });

  // ---------- lista ----------
  const List = {
    render() {
      const d = State.draw(); if (!d) return go("org");
      const ev = State.event();
      $("#qlist").innerHTML = d.items.map((it, i) => {
        const msg = encodeURIComponent(`🎁 ${ev.title || "Amigo Secreto"}: ${it.name}, seu link secreto (só você abre): ${it.url}`);
        return `<div class="q-item"><span class="qn">${esc(it.name)}${it.resp ? ` <span class="hint">· com ${esc(it.resp)}</span>` : ""}</span>
          <button class="btn" data-show="${i}">Mostrar QR</button>
          <a class="btn wa" href="https://wa.me/?text=${msg}" target="_blank" rel="noopener">WhatsApp</a></div>`;
      }).join("");
    },
  };
  $("#show-list").addEventListener("click", () => go("list"));
  $("#qlist").addEventListener("click", (e) => {
    const b = e.target.closest("[data-show]"); if (!b) return;
    Show.i = Number(b.dataset.show); go("show"); Show.render();
  });

  const wishReady = new Promise((res) => { if (window.Wish) res(); else window.addEventListener("wish-ready", res, { once: true }); });
  const CATS = [["🎁", "surpresa"], ["📚", "livro"], ["👕", "roupa"], ["🎮", "jogo"], ["🍫", "comida"], ["🧴", "cosmético"], ["🎧", "eletrônico"], ["🏠", "casa"], ["🌱", "planta"], ["⚽", "esporte"]];
  const catEmoji = (id) => (CATS.find((c) => c[1] === id) || CATS[0])[0];
  const fmtTime = (ts) => ts?.toDate ? ts.toDate().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const daysUntil = (iso) => { if (!iso) return null; const d = new Date(iso + "T00:00:00"); return Math.ceil((d - new Date()) / 86400000); };

  // ---------- cartinha e bilhetes (na tela de revelação) ----------
  const WishUI = {
    unsubs: [],
    stop() { this.unsubs.forEach((u) => u && u()); this.unsubs = []; },
    async start(data) {
      await wishReady;
      const W = window.Wish;
      const secret = W.secretFor(data);
      const mine = await W.ids(secret, data.g), theirs = await W.ids(secret, data.r);
      const eventId = mine.eventId;
      $("#wish-area").hidden = false;
      const days = daysUntil(data.ev?.date);
      $("#rv-countdown").textContent = days == null ? "" : days > 1 ? `Faltam ${days} dias para a troca 🎄` : days === 1 ? "A troca é amanhã! 🎄" : days === 0 ? "A troca é hoje! 🎄" : "A troca já passou. Valeu! 🎄";
      $("#w-their-name").textContent = data.r;
      $$(".want-cat").forEach((sel) => { sel.innerHTML = CATS.map(([e, id]) => `<option value="${id}">${e}</option>`).join(""); });

      // cartinha da pessoa que eu tirei
      this.unsubs.push(W.watchWish(eventId, theirs.wid, (w, err) => {
        const el = $("#w-their");
        if (err) { el.innerHTML = `<p class="hint">Não consegui carregar agora.</p>`; return; }
        if (!w) { el.innerHTML = `<p class="hint">${esc(data.r)} ainda não escreveu a cartinha. Mande um bilhete pedindo!</p>`; return; }
        el.innerHTML = (w.wants || []).map((x) => `<div class="want"><span class="cat">${catEmoji(x.cat)}</span><span>${esc(x.text)}</span></div>`).join("")
          + (w.sizes ? `<p class="wmeta"><b>Tamanho e cores:</b> ${esc(w.sizes)}</p>` : "")
          + (w.avoid ? `<p class="wmeta"><b>Nem pensar:</b> ${esc(w.avoid)}</p>` : "")
          + (w.tip ? `<p class="wmeta"><b>Dica:</b> ${esc(w.tip)}</p>` : "")
          + (!w.wants?.length && !w.sizes && !w.avoid && !w.tip ? `<p class="hint">Cartinha em branco por enquanto.</p>` : "");
      }));

      // minha cartinha
      this.unsubs.push(W.watchWish(eventId, mine.wid, (w) => {
        if (!w || document.activeElement?.closest(".wcard.mine")) { if (!w) $("#w-mine-status").textContent = "· ainda não salva"; return; }
        $$(".want-row").forEach((row, i) => { const x = w.wants?.[i]; row.querySelector(".want-cat").value = x?.cat || "surpresa"; row.querySelector(".want-text").value = x?.text || ""; });
        $("#w-sizes").value = w.sizes || ""; $("#w-avoid").value = w.avoid || ""; $("#w-tip").value = w.tip || "";
        $("#w-mine-status").textContent = w.updatedAt ? `· salva em ${fmtTime(w.updatedAt)}` : "· salva";
      }));
      $("#w-save").onclick = async () => {
        const wants = $$(".want-row").map((row) => ({ cat: row.querySelector(".want-cat").value, text: row.querySelector(".want-text").value }));
        try { await W.saveWish(eventId, mine.wid, { wants, sizes: $("#w-sizes").value, avoid: $("#w-avoid").value, tip: $("#w-tip").value }); toast("Cartinha salva. Quem tirou você já pode ver."); }
        catch (e) { toast("Não consegui salvar. Tente de novo."); }
      };

      // bilhetes: para quem eu tirei (eu sou "giver" no fio da pessoa) e do meu amigo secreto (eu sou "receiver" no meu fio)
      const renderNotes = (el, notes, meFrom) => {
        el.innerHTML = notes.map((n) => `<div class="note ${n.from === meFrom ? "me" : "them"}">${esc(n.text)}<small>${fmtTime(n.at)}</small></div>`).join("");
        el.scrollTop = el.scrollHeight;
      };
      this.unsubs.push(W.watchNotes(eventId, theirs.wid, (notes) => renderNotes($("#n-out"), notes, "giver")));
      this.unsubs.push(W.watchNotes(eventId, mine.wid, (notes) => renderNotes($("#n-in"), notes, "receiver")));
      const send = async (inputSel, wid, from) => {
        const inp = $(inputSel); const text = inp.value.trim(); if (!text) return;
        try { await W.sendNote(eventId, wid, from, text); inp.value = ""; } catch { toast("Não consegui enviar."); }
      };
      $("#n-out-send").onclick = () => send("#n-out-text", theirs.wid, "giver");
      $("#n-in-send").onclick = () => send("#n-in-text", mine.wid, "receiver");
      $("#n-out-text").onkeydown = (e) => { if (e.key === "Enter") $("#n-out-send").click(); };
      $("#n-in-text").onkeydown = (e) => { if (e.key === "Enter") $("#n-in-send").click(); };
    },
  };

  // ---------- quadro das cartinhas (organizador) ----------
  const Board = {
    async render() {
      const d = State.draw(), ev = State.event();
      $("#board").hidden = !d;
      if (!d) return;
      $("#board-list").innerHTML = `<p class="hint">Consultando…</p>`;
      await wishReady;
      const W = window.Wish;
      const secret = d.secret || W.secretFor({ ev });
      let done = 0;
      const rows = [];
      for (const it of d.items) {
        const { eventId, wid } = await W.ids(secret, it.name);
        let ok = false;
        try { ok = !!(await W.getWish(eventId, wid)); } catch {}
        if (ok) done++;
        const msg = encodeURIComponent(`🎁 ${ev.title || "Amigo Secreto"}: ${it.name}, sua cartinha ainda está em branco! Abra seu link secreto e escreva o que quer ganhar.`);
        rows.push(`<div class="b-item"><span class="${ok ? "ok" : "no"}">${ok ? "✓" : "–"}</span><span>${esc(it.name)}${it.resp ? ` <span class="hint">· com ${esc(it.resp)}</span>` : ""}</span>${ok ? "" : `<a class="wa" href="https://wa.me/?text=${msg}" target="_blank" rel="noopener">cutucar</a>`}</div>`);
      }
      $("#board-count").textContent = `${done} de ${d.items.length}`;
      $("#board-list").innerHTML = rows.join("");
    },
  };
  $("#board-refresh").addEventListener("click", () => Board.render());

  // ---------- revelação ----------
  const Reveal = {
    async open(token) {
      go("reveal");
      let data;
      try { data = await unseal(token); }
      catch { $("#rv-who").textContent = "Link inválido"; $("#rv-sub").hidden = true; $("#rv-gift").hidden = true; $("#rv-error").hidden = false; $("#rv-error").textContent = "Este QR não abriu direito. Peça ao organizador para mostrar de novo."; return; }
      $("#rv-event").textContent = data.ev?.title || "Amigo Secreto";
      $("#rv-who").textContent = data.resp ? `${data.g} (com ${data.resp})` : data.g;
      const meta = [data.ev?.date ? `Troca em ${data.ev.date.split("-").reverse().join("/")}` : "", data.ev?.value ? `Valor: ${data.ev.value}` : ""].filter(Boolean).join(" · ");
      $("#rv-meta").textContent = meta;
      const gift = $("#rv-gift");
      gift.onclick = () => {
        if (gift.classList.contains("opening")) return;
        gift.classList.add("opening");
        setTimeout(() => {
          gift.hidden = true;
          const n = $("#rv-name"); n.textContent = data.r; n.hidden = false;
          $("#rv-sub").textContent = "Você tirou";
          $("#rv-hint").hidden = false;
          WishUI.start(data).catch(() => toast("Cartinha indisponível no momento."));
        }, 1200);
      };
    },
  };

  // ---------- init ----------
  const h = location.hash;
  if (h.startsWith("#t=")) { Reveal.open(h.slice(3)); }
  else {
    if (h.startsWith("#setup=")) {
      try {
        const s = unpackSetup(h.slice(7));
        if (s.people?.length) {
          if (!State.people().length || confirm(`Carregar ${s.people.length} participantes do link? Isso substitui a lista atual.`)) {
            LS.set("people", s.people); LS.set("event", s.event || State.event()); LS.set("draw", null);
            toast(`${s.people.length} participantes carregados`);
          }
        }
      } catch { toast("Link de configuração inválido"); }
      history.replaceState(null, "", location.pathname);
    }
    go("org");
  }
})();
