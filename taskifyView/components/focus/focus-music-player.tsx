"use client";

import { useState, useRef, useEffect } from "react";
import {
  Music,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface Track {
  id: string;
  name: string;
  category: string;
  // Using free ambient sounds - can be replaced with actual audio URLs
  url?: string;
}

const TRACKS: Track[] = [
  { id: "lofi-1", name: "Lo-Fi Beats", category: "Lo-Fi" },
  { id: "lofi-2", name: "Chill Vibes", category: "Lo-Fi" },
  { id: "nature-1", name: "Rain Sounds", category: "Nature" },
  { id: "nature-2", name: "Forest Ambience", category: "Nature" },
  { id: "white-1", name: "White Noise", category: "White Noise" },
  { id: "white-2", name: "Brown Noise", category: "White Noise" },
];

const CATEGORIES = ["All", "Lo-Fi", "Nature", "White Noise"];

export function FocusMusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const filteredTracks =
    selectedCategory === "All"
      ? TRACKS
      : TRACKS.filter((t) => t.category === selectedCategory);

  const currentTrack = filteredTracks[currentTrackIndex] || TRACKS[0];

  // Generate ambient sound using Web Audio API (placeholder for actual audio files)
  useEffect(() => {
    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const generateAmbientSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const ctx = audioContextRef.current;

    // Stop existing oscillator
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
    }

    // Create noise (simplified ambient sound)
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Generate noise based on track category
    const isWhiteNoise = currentTrack.category === "White Noise";
    const isBrownNoise = currentTrack.id === "white-2";

    let lastValue = 0;
    for (let i = 0; i < bufferSize; i++) {
      if (isBrownNoise) {
        // Brown noise (smoother)
        const white = Math.random() * 2 - 1;
        lastValue = (lastValue + 0.02 * white) / 1.02;
        output[i] = lastValue * 3.5;
      } else if (isWhiteNoise) {
        // White noise
        output[i] = Math.random() * 2 - 1;
      } else {
        // Filtered noise for lo-fi/nature feel
        const white = Math.random() * 2 - 1;
        lastValue = (lastValue + 0.1 * white) / 1.1;
        output[i] = lastValue * 2;
      }
    }

    const whiteNoiseSource = ctx.createBufferSource();
    whiteNoiseSource.buffer = noiseBuffer;
    whiteNoiseSource.loop = true;

    // Create gain node for volume control
    gainNodeRef.current = ctx.createGain();
    gainNodeRef.current.gain.value = isMuted ? 0 : volume / 100;

    // Create filter for softer sound
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = currentTrack.category === "Lo-Fi" ? 800 : 2000;

    whiteNoiseSource.connect(filter);
    filter.connect(gainNodeRef.current);
    gainNodeRef.current.connect(ctx.destination);

    whiteNoiseSource.start();
    oscillatorRef.current = whiteNoiseSource as unknown as OscillatorNode;
  };

  const togglePlay = () => {
    if (isPlaying) {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      setIsPlaying(false);
    } else {
      generateAmbientSound();
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVolume / 100;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? volume / 100 : 0;
    }
  };

  const nextTrack = () => {
    const wasPlaying = isPlaying;
    if (isPlaying) {
      oscillatorRef.current?.stop();
      oscillatorRef.current?.disconnect();
    }
    setCurrentTrackIndex((prev) => (prev + 1) % filteredTracks.length);
    if (wasPlaying) {
      setTimeout(() => generateAmbientSound(), 100);
    }
  };

  const prevTrack = () => {
    const wasPlaying = isPlaying;
    if (isPlaying) {
      oscillatorRef.current?.stop();
      oscillatorRef.current?.disconnect();
    }
    setCurrentTrackIndex(
      (prev) => (prev - 1 + filteredTracks.length) % filteredTracks.length,
    );
    if (wasPlaying) {
      setTimeout(() => generateAmbientSound(), 100);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Music className="size-5" />
        <span className="text-sm font-medium">Focus Music</span>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setSelectedCategory(category);
              setCurrentTrackIndex(0);
            }}
            className="text-xs h-7"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Current Track Display */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-medium text-sm">{currentTrack.name}</p>
            <p className="text-xs text-muted-foreground">
              {currentTrack.category}
            </p>
          </div>
          <div
            className={cn(
              "size-2 rounded-full",
              isPlaying ? "bg-chart-2 animate-pulse" : "bg-muted-foreground/30",
            )}
          />
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={prevTrack}>
            <SkipBack className="size-4" />
          </Button>
          <Button
            variant={isPlaying ? "secondary" : "default"}
            size="icon"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={nextTrack}>
            <SkipForward className="size-4" />
          </Button>
        </div>
      </div>

      {/* Volume Control */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={toggleMute}>
          {isMuted || volume === 0 ? (
            <VolumeX className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </Button>
        <Slider
          value={[isMuted ? 0 : volume]}
          onValueChange={handleVolumeChange}
          max={100}
          step={1}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-8 text-right">
          {isMuted ? 0 : volume}%
        </span>
      </div>

      {/* Track List */}
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {filteredTracks.map((track, index) => (
          <button
            key={track.id}
            onClick={() => {
              const wasPlaying = isPlaying;
              if (isPlaying) {
                oscillatorRef.current?.stop();
                oscillatorRef.current?.disconnect();
              }
              setCurrentTrackIndex(index);
              if (wasPlaying) {
                setTimeout(() => generateAmbientSound(), 100);
              }
            }}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
              currentTrackIndex === index
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {track.name}
          </button>
        ))}
      </div>
    </div>
  );
}
