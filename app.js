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
    const items = [];
    for (const [g, r] of pairs) {
      const giver = byId[g], recv = byId[r];
      const resp = giver.resp ? byId[giver.resp] : null;
      const token = await seal({ g: giver.name, r: recv.name, rf: recv.family || "", resp: resp?.name || "", ev: { title: ev.title, date: ev.date, value: ev.value } });
      items.push({ id: giver.id, name: giver.name, resp: resp?.name || "", url: `${BASE}#t=${token}` });
    }
    // ordem de apresentação: responsável seguido das crianças dele
    const order = [];
    for (const p of people) { if (p.resp) continue; order.push(p.id); people.filter((c) => c.resp === p.id).forEach((c) => order.push(c.id)); }
    items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    LS.set("draw", { at: Date.now(), items });
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
