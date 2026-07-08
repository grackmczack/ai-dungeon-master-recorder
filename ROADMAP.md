# DND Recorder Roadmap

## v0 — aktuell in Arbeit

### Offen / Geplant
- [ ] Settings: Prompt-Feld (aktuell genutzter System-Prompt für LLM eintragbar)
- [ ] Settings: Kampagnen-Kontext-Feld (DM kann allgemeine Kampagnen-Infos hinterlegen → geht als Kontext an LLM)
- [ ] Struktur: Kampagne ist Oberebene (nicht Gruppe→Kampagne, sondern Kampagne direkt mit Mitglieder-Verwaltung)
- [ ] UI: Status-Widget live (zeigt ob gerade aufgenommen / transkribiert / summarized wird)
- [ ] UI: Tagebuch-Tab in Kampagne (alle Session-Summaries chronologisch untereinander)
- [ ] Mitglieder: Discord-Username ↔ Charaktername Zuordnung direkt in Kampagne (nicht nur per Session)

## v1 — nächste Hauptversion

- [ ] Charakter-Avatarbild + Gesichtsbild hochladen (pro Mitglied)
- [ ] Epische Session-Bilder generieren (Replicate Seedream) mit Protagonisten + Höhepunkt der Session
- [ ] Charactersheet als PDF hinterlegen (pro Mitglied) → wird als Kontext an LLM mitgegeben
- [ ] Multi-User: Admin/User Rollensystem
- [ ] Kampagnen-Übersicht öffentlich teilbar (Share-Link)

---

## v1 — Kampagnen-Wiki (kumulatives Gedächtnis)

### Konzept: "Living Lore"
Nicht linear wie das Tagebuch, sondern eine wachsende Wissensdatenbank der Kampagne.
Jede Session trägt neue Einträge bei oder aktualisiert bestehende.

### Entitäten die akkumuliert werden:
- **Quests** — Status: offen / laufend / gelöst / fehlgeschlagen
- **NSCs** — wächst mit jeder Erwähnung, wird angereichert
- **Orte** — mit allen Sessions verknüpft in denen sie vorkamen
- **Beute & Items** — wer hat was, ist es noch relevant?
- **Offene Fäden** — das Herzstück (siehe unten)

### Offene Fäden — das spannende Problem
**Herausforderung:** Ein Faden aus Session 3 ("Wer hat den Schlüssel?") wird in Session 8 gelöst.
Wie verknüpft man das automatisch?

**Ansatz A — LLM-gestützte Erkennung (machbar):**
Nach jeder Session wird die LLM mit dem AKTUELLEN Stand der offenen Fäden gefüttert:
```
Bestehende offene Fäden:
- [F001] "Wer hat den Schlüssel zum Turm?" (offen seit Session 3)
- [F002] "Die verschwundene Händlerin" (offen seit Session 5)

Neue offene Fäden aus dieser Session:
- "Der Schlüssel wurde beim toten Wächter gefunden"
- "Die Händlerin war eine Agentin des Königs"

Aufgabe: Welche bestehenden Fäden werden gelöst/verändert? Welche sind neu?
```
→ LLM returned: F001 GELÖST durch Session 8, F002 UPDATE + neuer Faden F003

**Ansatz B — Manuelle Verknüpfung durch DM (einfacher):**
DM kann im Panel offene Fäden manuell als "gelöst durch Session X" markieren
oder Fäden aus der Session-Summary per Drag&Drop zu bestehenden verknüpfen.

**Empfehlung: Kombination** — LLM macht einen Vorschlag, DM bestätigt oder korrigiert.

### Datenmodell-Erweiterung (v1):
```
CampaignThread (offener Faden / Storyline)
  id, campaignId, title, description
  status: open / resolved / abandoned
  openedInSessionId, resolvedInSessionId
  linkedThreadIds[] (Verknüpfung mit anderen Fäden)
  
CampaignNPC
  id, campaignId, name, description
  firstSeenSessionId, lastSeenSessionId
  status: active / dead / unknown / ally / enemy
  sessionIds[] (alle Sessions mit Erwähnung)

CampaignLocation
  id, campaignId, name, description
  sessionIds[]
  
CampaignQuest
  id, campaignId, title, description
  status: discovered / active / completed / failed
  openedInSessionId, resolvedInSessionId
  rewardItems[]
```

### LLM-Prompt-Erweiterung nach jeder Session:
Zweiter LLM-Pass nach der Summary:
1. **Erster Pass** — wie heute: Session-Summary generieren
2. **Zweiter Pass** — "Reconciliation":
   - Bekommt: aktuelle Kampagnen-Wissensbasis + neue Session-Summary
   - Gibt zurück: Deltas (neue Entitäten, Status-Updates, Faden-Verknüpfungen)
   - Schreibt die Updates in die DB

### Implementierungsaufwand:
- DB-Schema: ~2h (4 neue Tabellen)
- LLM-Reconciliation-Prompt: ~3h (tricky, braucht gutes Prompting)
- Frontend Wiki-Ansicht: ~4h (neue Route /campaigns/:id/lore)
- Thread-Verknüpfung UI: ~3h
- Gesamt: ~1,5 Arbeitstage

### Machbarkeit:
✅ Technisch absolut machbar mit dem vorhandenen Stack
⚠️ Qualität hängt stark vom LLM ab — Claude Opus 4.8 ist gut genug dafür
⚠️ Bei langen Kampagnen (50+ Sessions) wird der Kontext groß → braucht Zusammenfassung/Komprimierung
💡 Tipp: Fäden mit Embedding-Vektoren speichern (pgvector) für semantische Ähnlichkeitssuche
   → "Dieser neue Faden klingt nach F001 aus Session 3" — ohne alten Kontext rein zu laden

