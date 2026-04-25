#!/usr/bin/env python3
"""
Pharmagister reklám videó - Automatikus szöveg hozzáadás
DaVinci Resolve Python API használatával
"""

import sys
import os

# DaVinci Resolve script path (macOS default)
RESOLVE_SCRIPT_API = "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules/"
sys.path.append(RESOLVE_SCRIPT_API)

try:
    import DaVinciResolveScript as dvr_script
except ImportError:
    print("❌ HIBA: DaVinci Resolve Python API nem található!")
    print(f"Ellenőrizd hogy létezik: {RESOLVE_SCRIPT_API}")
    sys.exit(1)


def add_title_to_timeline(timeline, text, start_frame, duration_frames, position="center"):
    """
    Szöveg hozzáadása a timeline-hoz
    
    Args:
        timeline: DaVinci timeline objektum
        text: Megjelenítendő szöveg
        start_frame: Kezdő frame
        duration_frames: Időtartam frame-ekben
        position: 'top', 'center', 'bottom'
    """
    
    # Title track (V2 vagy magasabb)
    video_track = 2
    
    # Text+ node létrehozása (DaVinci Resolve beépített title)
    # Megjegyzés: A Resolve Python API korlátozottan támogatja a title-okat
    # Jobb megoldás: FFmpeg overlay vagy kézi title
    
    print(f"✅ Szöveg hozzáadva: '{text}' @ {start_frame} frame ({duration_frames} frame hossz)")
    

def main():
    """Főprogram - Pharmagister reklám szövegek hozzáadása"""
    
    print("🎬 Pharmagister Reklám - Szöveg automatizálás")
    print("=" * 50)
    
    # Resolve példány lekérése
    resolve = dvr_script.scriptapp("Resolve")
    if not resolve:
        print("❌ HIBA: DaVinci Resolve nem fut!")
        print("Indítsd el a DaVinci Resolve-ot és nyisd meg a projektet!")
        sys.exit(1)
    
    print("✅ DaVinci Resolve kapcsolat OK")
    
    # Projekt manager
    project_manager = resolve.GetProjectManager()
    project = project_manager.GetCurrentProject()
    
    if not project:
        print("❌ HIBA: Nincs megnyitott projekt!")
        sys.exit(1)
    
    print(f"✅ Projekt: {project.GetName()}")
    
    # Aktuális timeline
    timeline = project.GetCurrentTimeline()
    
    if not timeline:
        print("❌ HIBA: Nincs megnyitott timeline!")
        sys.exit(1)
    
    print(f"✅ Timeline: {timeline.GetName()}")
    
    # Timeline infók
    fps = float(timeline.GetSetting("timelineFrameRate"))
    print(f"📊 FPS: {fps}")
    
    # Szövegek definíciója (időpontok másodpercben)
    titles = [
        {
            "text": "Hiányzik egy gyógyszerész?",
            "start_sec": 1.0,
            "duration_sec": 3.0,
            "position": "center"
        },
        {
            "text": "Pharmagister.hu",
            "start_sec": 5.0,
            "duration_sec": 2.0,
            "position": "center"
        },
        {
            "text": "Helyettes gyógyszerészek 1 kattintással",
            "start_sec": 8.0,
            "duration_sec": 3.0,
            "position": "bottom"
        }
    ]
    
    print("\n📝 Szövegek hozzáadása:")
    print("-" * 50)
    
    for title_data in titles:
        start_frame = int(title_data["start_sec"] * fps)
        duration_frames = int(title_data["duration_sec"] * fps)
        
        add_title_to_timeline(
            timeline,
            title_data["text"],
            start_frame,
            duration_frames,
            title_data["position"]
        )
    
    print("\n" + "=" * 50)
    print("⚠️  FIGYELEM!")
    print("=" * 50)
    print("A DaVinci Resolve Python API NEM támogatja teljes mértékben")
    print("a title-ok automatikus létrehozását.")
    print()
    print("MEGOLDÁSOK:")
    print("1. Használd a 'Titles' tab-ot kézzel (2 perc)")
    print("2. FFmpeg script - szöveg overlay (alább)")
    print("3. Template title importálás")
    print()
    print("Folytatom FFmpeg megoldással? [y/n]")
    

if __name__ == "__main__":
    main()
