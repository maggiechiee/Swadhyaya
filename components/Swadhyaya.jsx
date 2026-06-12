    const doshas = calcDoshas(((lagnaIdx%12)+12)%12, ((moonIdx%12)+12)%12, ((sunIdx%12)+12)%12, bd.time);
    
    return { lagna, moon, sun, nakshatra, nakIdx: nakIdx%27, md, ad, ss, doshas, lagnaIdx: ((lagnaIdx%12)+12)%12, moonIdx: ((moonIdx%12)+12)%12, sunIdx: ((sunIdx%12)+12)%12 };
  }, [bd]);

  async function askAI(q) {
    if (!chart || aiLoading) return;
    setAiLoading(true);
    const prompt = `Vedic birth chart:
- Lagna (Rising): ${chart.lagna.en} (${chart.lagna.name})
- Moon sign: ${chart.moon.en} (${chart.moon.name}) 
- Sun sign: ${chart.sun.en} (${chart.sun.name})
- Birth Nakshatra: ${chart.nakshatra.name} (lord: ${chart.nakshatra.lord})
- Current Mahadasha: ${chart.md.current?.planet || "unknown"}
- Antardasha: ${chart.ad?.current?.planet || "unknown"}
- Sade Sati active: ${chart.ss.isSadeSati ? "YES — " + chart.ss.phase : "No"}
- DOB: ${bd.dob}, Time: ${bd.time || "unknown"}, Place: ${bd.place || "unknown"}

Question: ${q || "Give a deep, personalised Vedic reading covering: core personality synthesis of these three signs, current life phase interpretation (Mahadasha + Antardasha), what this person needs to know right now, shadow work, and dharma. Be specific and personal. Reference the actual planets and signs. Max 250 words."}`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 700,
          system: "You are a deeply knowledgeable Vedic astrologer combining Jyotish with psychology. Be precise, specific to this exact chart, speak directly to the person. Warm but honest. Reference specific planet names, signs, and current dasha period.",
          messages: [{ role: "user", content: prompt }] }),
      });
      const d = await r.json();
      setAiInsight(d.content?.map(b => b.text || "").join("") || "Try again.");
    } catch { setAiInsight("Connection issue. Try again."); }
    setAiLoading(false);
  }

  const TABS = [
    {id:"overview",l:"Overview"},
    {id:"personality",l:"Personality"},
    {id:"dasha",l:"Dasha"},
    {id:"sadesati",l:"Sade Sati"},
    {id:"doshas",l:"Doshas"},
    {id:"nakshatra",l:"Nakshatra"},
    {id:"timing",l:"Timing"},
    {id:"ai",l:"✦ AI Reading"},
  ];

  if (step === "input") return (
    <div style={{padding:"20px 16px"}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:30,marginBottom:8,color:G.accent}}>✦</div>
        <div style={{fontSize:22,fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",marginBottom:6}}>Your Birth Chart</div>
        <div style={{fontSize:13,color:G.muted,lineHeight:1.7}}>Jyotish maps your inner world from the exact moment you were born. The more precise the birth time, the more accurate the reading.</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <BCField label="DATE OF BIRTH *" G={G}><input type="date" value={bd.dob} onChange={e=>setBd(d=>({...d,dob:e.target.value}))} style={bcInput(G)}/></BCField>
        <BCField label="BIRTH TIME" G={G}>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            {[{v:"yes",l:"I know exactly"},{v:"approx",l:"Rough idea"},{v:"no",l:"Don't know"}].map(o=>(
              <button key={o.v} onClick={()=>setBd(d=>({...d,knowsTime:o.v}))} style={{flex:1,padding:"8px 4px",borderRadius:8,border:`1px solid ${bd.knowsTime===o.v?G.accent:G.border}`,background:bd.knowsTime===o.v?G.accent+"18":"transparent",cursor:"pointer",fontSize:11,color:bd.knowsTime===o.v?G.accent:G.muted}}>{o.l}</button>
            ))}
          </div>
          {bd.knowsTime!=="no"&&<input type="time" value={bd.time} onChange={e=>setBd(d=>({...d,time:e.target.value}))} style={bcInput(G)}/>}
          {bd.knowsTime==="no"&&<div style={{fontSize:12,color:G.muted,padding:"10px 12px",background:G.card,borderRadius:8,border:`1px solid ${G.border}`,lineHeight:1.6}}>Without birth time, Lagna cannot be precisely calculated. You can manually select your Lagna below if you know it.</div>}
        </BCField>
        <BCField label="BIRTH PLACE" G={G}><input value={bd.place} onChange={e=>setBd(d=>({...d,place:e.target.value}))} placeholder="City, State, Country" style={bcInput(G)}/></BCField>
        <div style={{padding:"14px 16px",background:G.card,border:`1px solid ${G.gold}44`,borderRadius:12}}>
          <div style={{fontSize:10,color:G.gold,fontFamily:"'DM Mono',monospace",letterSpacing:2,marginBottom:10}}>ALREADY KNOW YOUR SIGNS? (More accurate)</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[{l:"Lagna (Rising Sign)",k:"manualLagna"},{l:"Moon Sign (Chandra Rashi)",k:"manualMoon"},{l:"Sun Sign (Surya Rashi)",k:"manualSun"}].map((f,i)=>(
              <div key={i}>
                <div style={{fontSize:10,color:G.muted,marginBottom:5}}>{f.l}</div>
                <select value={bd[f.k]} onChange={e=>setBd(d=>({...d,[f.k]:e.target.value}))} style={{...bcInput(G),fontSize:13}}>
                  <option value="">Calculate automatically</option>
                  {RASHIS_V.map(r=><option key={r.name} value={r.en}>{r.symbol} {r.en} ({r.name})</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
        <button onClick={()=>{
    if(!bd.dob) return;
    setStep("chart");
    // Save birth details to profile
    if(profile.up) {
      profile.up("birthTime", bd.time);
      profile.up("birthPlace", bd.place);
      profile.up("manualLagna", bd.manualLagna);
      profile.up("manualMoon", bd.manualMoon);
      profile.up("manualSun", bd.manualSun);
    }
  }} disabled={!bd.dob} style={{padding:"15px",background:bd.dob?`linear-gradient(135deg,${G.accent},${G.warm})`:G.border,border:"none",borderRadius:12,color:"#fff",cursor:bd.dob?"pointer":"not-allowed",fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontStyle:"italic",marginTop:6}}>
          {bd.dob?"Read My Chart →":"Enter date of birth to continue"}
        </button>
      </div>
    </div>
  );

  if (!chart) return null;

  return (
    <div>
      {/* Sign trio header */}
      <div style={{padding:"16px 16px 0"}}>
        {/* Galaxy mode header banner */}
        <div style={{background:"linear-gradient(135deg,#0a0520,#1a0a3a)",borderRadius:14,padding:"18px 18px 14px",marginBottom:14,position:"relative",overflow:"hidden"}}>
          {[...Array(16)].map((_,i)=><div key={i} style={{position:"absolute",left:`${(i*37)%100}%`,top:`${(i*53)%100}%`,width:i%4===0?2.5:1.5,height:i%4===0?2.5:1.5,borderRadius:"50%",background:"#e8e0ff",opacity:0.15+Math.sin(i)*0.1}}/>)}
          <div style={{position:"relative",zIndex:1}}>
            <div style={{fontSize:10,color:"#c084fc88",fontFamily:"'DM Mono',monospace",letterSpacing:3,marginBottom:6}}>✦ JYOTISH · VEDIC BIRTH CHART</div>
            <div style={{fontSize:22,fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",color:"#ede8ff",marginBottom:4}}>
              {chart?.lagna?.en} Rising · {chart?.moon?.en} Moon · {chart?.sun?.en} Sun
            </div>
            <div style={{fontSize:12,color:"#7a6fa8"}}>
              {chart?.nakshatra?.name} Nakshatra · {chart?.md?.current?.planet} Mahadasha
              {chart?.ss?.isSadeSati?" · ⚠ Sade Sati Active":""}
            </div>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:15,fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic"}}>✦ Vedic Birth Chart</div>
          <button onClick={()=>setStep("input")} style={{fontSize:11,color:G.muted,background:"transparent",border:`1px solid ${G.border}`,borderRadius:20,padding:"4px 12px",cursor:"pointer"}}>Edit</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
          {[{sign:chart.lagna,label:"Lagna",icon:"⬆"},{sign:chart.moon,label:"Chandra",icon:"🌙"},{sign:chart.sun,label:"Surya",icon:"☀"}].map((item,i)=>(
            <div key={i} style={{background:G.card,border:`1px solid ${item.sign.color}44`,borderRadius:12,padding:"12px 8px",textAlign:"center",boxShadow:`0 0 20px ${item.sign.color}18`,position:"relative",overflow:"hidden",minHeight:90}}>
              <ConstellationBg sign={item.sign.en} size={120} opacity={0.18}/>
              <div style={{position:"relative",zIndex:1}}>
                <div style={{fontSize:9,color:G.muted,fontFamily:"'DM Mono',monospace",marginBottom:4}}>{item.icon} {item.label}</div>
                <div style={{fontSize:24,marginBottom:3}}>{item.sign.symbol}</div>
                <div style={{fontSize:12,fontWeight:700,color:item.sign.color}}>{item.sign.en}</div>
                <div style={{fontSize:9,color:G.dim}}>{item.sign.element}</div>
              </div>
            </div>
          ))}
        </div>
        {/* Quick status bar */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          <div style={{fontSize:11,padding:"4px 10px",background:MAHADASHA_INFO[chart.md.current?.planet]?.color+"22",border:`1px solid ${MAHADASHA_INFO[chart.md.current?.planet]?.color}44`,borderRadius:20,color:MAHADASHA_INFO[chart.md.current?.planet]?.color}}>
            {chart.md.current?.planet} Mahadasha
          </div>
          {chart.ad?.current&&<div style={{fontSize:11,padding:"4px 10px",background:MAHADASHA_INFO[chart.ad.current.planet]?.color+"18",border:`1px solid ${MAHADASHA_INFO[chart.ad.current.planet]?.color}33`,borderRadius:20,color:MAHADASHA_INFO[chart.ad.current.planet]?.color}}>
            {chart.ad.current.planet} Antardasha
          </div>}
          {chart.ss.isSadeSati&&<div style={{fontSize:11,padding:"4px 10px",background:"#7090a844",border:"1px solid #7090a866",borderRadius:20,color:"#7090a8"}}>
            ⚠ Sade Sati Active
          </div>}
          {chart.ss.isDhaiya&&!chart.ss.isSadeSati&&<div style={{fontSize:11,padding:"4px 10px",background:"#7090a822",border:"1px solid #7090a844",borderRadius:20,color:"#7090a8"}}>
            Dhaiya Active
          </div>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{overflowX:"auto",display:"flex",borderBottom:`1px solid ${G.border}`,padding:"0 4px",background:G.surface,WebkitOverflowScrolling:"touch"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{flexShrink:0,padding:"10px 12px",border:"none",background:"none",cursor:"pointer",fontFamily:"'Jost',sans-serif",fontSize:11,color:activeTab===t.id?G.accent:G.muted,borderBottom:activeTab===t.id?`2px solid ${G.accent}`:"2px solid transparent",whiteSpace:"nowrap"}}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{padding:"20px 16px 40px"}}>

        {/* ── OVERVIEW ── */}
        {activeTab==="overview"&&(
          <div>
            <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,padding:20,marginBottom:14,fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontStyle:"italic",lineHeight:2,color:G.text}}>
              You are <span style={{color:chart.lagna.color,fontWeight:600}}>{chart.lagna.en} rising</span> — the face you show the world.
              At your emotional core, <span style={{color:chart.moon.color,fontWeight:600}}>{chart.moon.en} Moon</span> — the self that exists before the world asks anything of you.
              Your consciousness grows toward <span style={{color:chart.sun.color,fontWeight:600}}>{chart.sun.en} Sun</span> — who you are becoming.
              Your birth nakshatra is <span style={{color:G.gold,fontWeight:600}}>{chart.nakshatra.name}</span>.
            </div>
            {[
              {sign:chart.lagna,lens:"Rising — How you appear",desc:chart.lagna.personality.slice(0,3).join(" · ")},
              {sign:chart.moon,lens:"Moon — How you feel",desc:chart.moon.personality.slice(0,3).join(" · ")},
              {sign:chart.sun,lens:"Sun — Who you're becoming",desc:chart.sun.personality.slice(0,3).join(" · ")},
            ].map((item,i)=>(
              <div key={i} style={{padding:"12px 16px",background:item.sign.color+"12",border:`1px solid ${item.sign.color}33`,borderRadius:10,marginBottom:9}}>
                <div style={{fontSize:10,color:item.sign.color,fontFamily:"'DM Mono',monospace",letterSpacing:1,marginBottom:3}}>{item.lens.toUpperCase()}</div>
                <div style={{fontSize:14,fontWeight:600,color:item.sign.color,marginBottom:3}}>{item.sign.en}</div>
                <div style={{fontSize:13,color:G.text,lineHeight:1.6}}>{item.desc}</div>
              </div>
            ))}
            <div style={{background:G.card,border:`1px solid ${G.gold}33`,borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:10,color:G.gold,fontFamily:"'DM Mono',monospace",letterSpacing:2,marginBottom:8}}>✦ NAKSHATRA · {chart.nakshatra.name}</div>
              <div style={{fontSize:13,color:G.text,lineHeight:1.7,marginBottom:6}}>{chart.nakshatra.gift}</div>
              <div style={{fontSize:12,color:G.red}}>Shadow: {chart.nakshatra.shadow}</div>
            </div>
          </div>
        )}

        {/* ── PERSONALITY ── */}
        {activeTab==="personality"&&(
          <div>
            {[
              {sign:chart.lagna,lens:"Lagna (Rising) — Your outer self · First impression · Physical body"},
              {sign:chart.moon,lens:"Chandra (Moon) — Your emotional nature · What you need · Inner world"},
              {sign:chart.sun,lens:"Surya (Sun) — Your life force · Identity · Who you're growing into"},
            ].map((item,i)=>(
              <div key={i} style={{background:G.card,border:`1px solid ${item.sign.color}44`,borderRadius:14,padding:20,marginBottom:14}}>
                <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
                  <div style={{fontSize:34}}>{item.sign.symbol}</div>
                  <div>
                    <div style={{fontSize:11,color:item.sign.color,fontFamily:"'DM Mono',monospace",letterSpacing:1,marginBottom:2}}>{item.lens}</div>
                    <div style={{fontSize:18,fontWeight:600,color:item.sign.color}}>{item.sign.en} · {item.sign.name}</div>
                    <div style={{fontSize:11,color:G.muted}}>{item.sign.element} · {item.sign.quality} · Ruled by {item.sign.rulingEn}</div>
                  </div>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                  {item.sign.personality.map((t,j)=><span key={j} style={{fontSize:11,padding:"4px 10px",background:item.sign.color+"22",border:`1px solid ${item.sign.color}44`,borderRadius:20,color:item.sign.color}}>{t}</span>)}
                </div>
                <div style={{fontSize:14,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",lineHeight:1.8,color:G.text,padding:"12px 14px",background:G.surface,borderRadius:8,marginBottom:10}}>"{item.sign.strength}"</div>
                <div style={{fontSize:12,color:G.gold,marginBottom:6,fontStyle:"italic"}}>Life theme: {item.sign.lifeTheme}</div>
                <div style={{fontSize:12,color:G.warm}}>Relationships: {item.sign.relationships}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── DASHA ── */}
        {activeTab==="dasha"&&(
          <div>
            <div style={{fontSize:13,color:G.muted,marginBottom:16,lineHeight:1.7}}>The Vimshottari Dasha divides your life into planetary chapters — each planet rules a period and colours every decision, relationship, and opportunity within it.</div>

            {/* Current Mahadasha */}
            {chart.md.current&&(()=>{
              const info=MAHADASHA_INFO[chart.md.current.planet];
              const now=new Date();
              const totalMs=chart.md.current.end-chart.md.current.start;
              const doneMs=now-chart.md.current.start;
              const pct=Math.round((doneMs/totalMs)*100);
              return(
                <div style={{background:G.card,border:`2px solid ${info.color}66`,borderRadius:14,padding:20,marginBottom:14,boxShadow:`0 0 24px ${info.color}22`}}>
                  <div style={{fontSize:10,color:info.color,fontFamily:"'DM Mono',monospace",letterSpacing:2,marginBottom:12}}>◉ CURRENT MAHADASHA — ACTIVE NOW</div>
                  <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:14}}>
                    <div style={{padding:"12px 16px",background:info.color+"22",border:`2px solid ${info.color}44`,borderRadius:10,textAlign:"center",minWidth:80,flexShrink:0}}>
                      <div style={{fontSize:18,fontWeight:700,color:info.color}}>{chart.md.current.planet}</div>
                      <div style={{fontSize:9,color:G.dim}}>{info.en}</div>
                      <div style={{fontSize:9,color:G.muted,marginTop:4}}>{chart.md.current.years} years</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:info.color,marginBottom:4,fontWeight:600}}>{info.theme}</div>
                      <div style={{fontSize:11,color:G.muted,marginBottom:2}}>{fmtDate(chart.md.current.start)} → {fmtDate(chart.md.current.end)}</div>
                      <div style={{background:G.border,borderRadius:4,height:5,marginTop:8,marginBottom:4}}><div style={{width:`${pct}%`,height:5,background:info.color,borderRadius:4}}/></div>
                      <div style={{fontSize:10,color:G.dim}}>{pct}% complete</div>
                    </div>
                  </div>
                  <div style={{fontSize:13,lineHeight:1.75,color:G.text,marginBottom:10}}>{info.good?`✓ Supports: ${info.good}`:""}</div>
                  {info.challenging&&<div style={{fontSize:12,color:G.red,lineHeight:1.6,marginBottom:10}}>⚠ Watch for: {info.challenging}</div>}
                  <div style={{fontSize:12,color:G.accent2}}>Remedy: {info.remedy}</div>
                </div>
              );
            })()}
