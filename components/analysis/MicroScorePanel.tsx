'use client';

import { useState } from 'react';
import type { MicroSegmentScores } from '@/types';

interface MicroScorePanelProps {
  scores: MicroSegmentScores;
  label: string;
}

function pct(v: number) {
  return Math.round(v * 100);
}

function inv(v: number) {
  return 1 - v;
}

interface BarProps {
  label: string;
  value: number; // 0–1
  negative?: boolean;
}

function ScoreBar({ label, value, negative = false }: BarProps) {
  const display = negative ? inv(value) : value;
  const p = pct(display);
  const color =
    p >= 75 ? 'bg-[#6EA556]' : p >= 50 ? 'bg-[#FFCC18]' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-44 shrink-0 truncate text-[#4A3220]/80 dark:text-[#F8F0E2]/70" title={label}>
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#CFBB92] dark:bg-[#3a2718]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${p}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums text-[#4A3220]/80 dark:text-[#F8F0E2]/70">
        {p}
      </span>
    </div>
  );
}

interface CategoryProps {
  title: string;
  avg: number;
  children: React.ReactNode;
}

function Category({ title, avg, children }: CategoryProps) {
  const p = pct(avg);
  const color = p >= 75 ? 'text-[#6EA556]' : p >= 50 ? 'text-[#FFCC18]' : 'text-red-400';
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between"
      >
        <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#1D2F45]/90 dark:text-[#F8F0E2]/90">
          <svg
            className={`h-3 w-3 shrink-0 text-[#4A3220]/60 dark:text-[#F8F0E2]/60 transition-transform ${expanded ? '' : '-rotate-90'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          {title}
        </span>
        <span className={`text-xs font-bold tabular-nums ${color}`}>{p}</span>
      </button>
      {expanded && <div className="space-y-1">{children}</div>}
    </div>
  );
}

function avg(...vals: number[]) {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function MicroScorePanel({ scores, label }: MicroScorePanelProps) {
  const { segmentation: sg, visualQuality: vq, subjectAnalysis: sa, motionAnalysis: ma,
    sceneUnderstanding: su, attentionEngagement: ae, taskSpecific: ts,
    audio: au, confidence: co, safety, finalOutputs: fo } = scores;

  const sgAvg = avg(sg.segmentOverlap, inv(sg.shotChanges) * 0.5 + 0.5, sg.actionPeakTime);
  const vqAvg = avg(vq.sharpness, vq.focusQuality, vq.exposure, vq.contrast, vq.brightnessStability,
    vq.colorBalance, vq.saturation, inv(vq.noiseLevel), inv(vq.compressionArtifacts),
    inv(vq.motionBlur), inv(vq.flicker), inv(vq.distortion));
  const saAvg = avg(sa.primarySubjectDetected, sa.subjectVisibility, inv(sa.occlusionLevel),
    sa.faceVisibility, sa.bodyVisibility, sa.objectRelevance, sa.subjectSizeInFrame, sa.subjectCentering);
  const maAvg = avg(sa.subjectVisibility, inv(ma.cameraShake), ma.motionSmoothness,
    ma.motionDirectionConsistency, ma.movementPrecision, inv(ma.jerkiness), ma.trajectoryCoherence);
  const suAvg = avg(su.actionComplexity, su.eventDensity, su.eventSalience,
    su.sceneContextConsistency, su.narrativeCoherence, su.causeEffectClarity);
  const aeAvg = avg(ae.hookStrength, ae.visualInterest, ae.pacing, ae.retentionPotential,
    ae.novelty, ae.emotionalImpact, ae.memorability, ae.scrollStoppingPower, ae.rewatchability, ae.energyLevel);
  const tsAvg = avg(ts.taskRelevance, ts.classificationAccuracy, ts.techniqueQuality,
    ts.timingAccuracy, ts.completionQuality, ts.successProbability, ts.goalAlignment, ts.rankingScore);
  const auAvg = avg(au.speechClarity, inv(au.backgroundNoiseLevel), au.audioVisualSync,
    au.rhythmAlignment, au.toneMatch);
  const coAvg = avg(co.modelConfidence, inv(co.predictionEntropy), inv(co.ambiguityScore),
    inv(co.missingDataRate), co.boundaryConfidence, co.crossFrameConsistency, co.reliabilityScore);

  return (
    <div className="animate-fade-in mt-4 space-y-4 rounded-xl border border-[#CFBB92] bg-[#EFE3CA] p-5 dark:border-[#6B5240] dark:bg-[#4A3220]/80">
      <div className="flex items-center justify-between border-b border-[#CFBB92] pb-3 dark:border-[#6B5240]/50">
        <div>
          <p className="text-sm font-semibold text-[#1D2F45] dark:text-[#F8F0E2]">Micro-Segmentation Analysis</p>
          <p className="text-xs text-[#4A3220]/60 dark:text-[#F8F0E2]/50">{label}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[#BD9A1F] dark:text-[#FFCC18]">{pct(fo.finalClipScore)}</p>
          <p className="text-xs text-[#4A3220]/60 dark:text-[#F8F0E2]/50">clip score</p>
        </div>
      </div>

      {/* Final output composite scores */}
      <div className="rounded-lg border border-[#CFBB92]/70 bg-[#E4D3B2]/50 p-3 dark:border-[#6B5240]/60 dark:bg-[#3a2718]/50">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#4A3220]/80 dark:text-[#F8F0E2]/70">Composite Outputs</p>
        <div className="grid gap-1 sm:grid-cols-2">
          <ScoreBar label="Segment Score" value={fo.segmentScore} />
          <ScoreBar label="Event Score" value={fo.eventScore} />
          <ScoreBar label="Technical Score" value={fo.technicalScore} />
          <ScoreBar label="Aesthetic Score" value={fo.aestheticScore} />
          <ScoreBar label="Engagement Score" value={fo.engagementScore} />
          <ScoreBar label="Task Score" value={fo.taskScore} />
          <ScoreBar label="Confidence Adjusted" value={fo.confidenceAdjustedScore} />
          <ScoreBar label="Penalty" value={fo.penaltyScore} negative />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Category title="Segmentation" avg={sgAvg}>
          <ScoreBar label="Shot Changes" value={sg.shotChanges} negative />
          <ScoreBar label="Scene Changes" value={sg.sceneChanges} negative />
          <ScoreBar label="Action Start" value={sg.actionStartTime} />
          <ScoreBar label="Action Peak" value={sg.actionPeakTime} />
          <ScoreBar label="Action End" value={sg.actionEndTime} />
          <ScoreBar label="Segment Overlap" value={sg.segmentOverlap} />
        </Category>

        <Category title="Visual Quality" avg={vqAvg}>
          <ScoreBar label="Sharpness" value={vq.sharpness} />
          <ScoreBar label="Focus Quality" value={vq.focusQuality} />
          <ScoreBar label="Exposure" value={vq.exposure} />
          <ScoreBar label="Contrast" value={vq.contrast} />
          <ScoreBar label="Brightness Stability" value={vq.brightnessStability} />
          <ScoreBar label="Color Balance" value={vq.colorBalance} />
          <ScoreBar label="Saturation" value={vq.saturation} />
          <ScoreBar label="Noise Level" value={vq.noiseLevel} negative />
          <ScoreBar label="Compression Artifacts" value={vq.compressionArtifacts} negative />
          <ScoreBar label="Motion Blur" value={vq.motionBlur} negative />
          <ScoreBar label="Flicker" value={vq.flicker} negative />
          <ScoreBar label="Distortion" value={vq.distortion} negative />
        </Category>

        <Category title="Subject Analysis" avg={saAvg}>
          <ScoreBar label="Primary Subject" value={sa.primarySubjectDetected} />
          <ScoreBar label="Secondary Subjects" value={sa.secondarySubjectCount} />
          <ScoreBar label="Object Count" value={sa.objectCount} />
          <ScoreBar label="Subject Visibility" value={sa.subjectVisibility} />
          <ScoreBar label="Occlusion" value={sa.occlusionLevel} negative />
          <ScoreBar label="Face Visibility" value={sa.faceVisibility} />
          <ScoreBar label="Body Visibility" value={sa.bodyVisibility} />
          <ScoreBar label="Object Relevance" value={sa.objectRelevance} />
          <ScoreBar label="Subject Size" value={sa.subjectSizeInFrame} />
          <ScoreBar label="Centering" value={sa.subjectCentering} />
        </Category>

        <Category title="Motion Analysis" avg={maAvg}>
          <ScoreBar label="Global Motion" value={ma.globalMotionIntensity} />
          <ScoreBar label="Local Motion" value={ma.localMotionIntensity} />
          <ScoreBar label="Camera Shake" value={ma.cameraShake} negative />
          <ScoreBar label="Smoothness" value={ma.motionSmoothness} />
          <ScoreBar label="Direction Consistency" value={ma.motionDirectionConsistency} />
          <ScoreBar label="Movement Speed" value={ma.movementSpeed} />
          <ScoreBar label="Precision" value={ma.movementPrecision} />
          <ScoreBar label="Symmetry" value={ma.movementSymmetry} />
          <ScoreBar label="Jerkiness" value={ma.jerkiness} negative />
          <ScoreBar label="Trajectory Coherence" value={ma.trajectoryCoherence} />
        </Category>

        <Category title="Scene Understanding" avg={suAvg}>
          <div className="space-y-0.5 pb-1">
            <p className="text-xs text-[#4A3220]/60 dark:text-[#F8F0E2]/50">
              <span className="text-[#4A3220]/80 dark:text-[#F8F0E2]/70">Scene: </span>{su.sceneCategory}
            </p>
            <p className="text-xs text-[#4A3220]/60 dark:text-[#F8F0E2]/50">
              <span className="text-[#4A3220]/80 dark:text-[#F8F0E2]/70">Environment: </span>{su.environmentType}
            </p>
            <p className="text-xs text-[#4A3220]/60 dark:text-[#F8F0E2]/50">
              <span className="text-[#4A3220]/80 dark:text-[#F8F0E2]/70">Setting: </span>{su.indoorOutdoor}
            </p>
            <p className="text-xs text-[#4A3220]/60 dark:text-[#F8F0E2]/50">
              <span className="text-[#4A3220]/80 dark:text-[#F8F0E2]/70">Activity: </span>{su.activityType}
            </p>
          </div>
          <ScoreBar label="Action Complexity" value={su.actionComplexity} />
          <ScoreBar label="Event Density" value={su.eventDensity} />
          <ScoreBar label="Event Salience" value={su.eventSalience} />
          <ScoreBar label="Context Consistency" value={su.sceneContextConsistency} />
          <ScoreBar label="Narrative Coherence" value={su.narrativeCoherence} />
          <ScoreBar label="Cause-Effect Clarity" value={su.causeEffectClarity} />
        </Category>

        <Category title="Attention & Engagement" avg={aeAvg}>
          <ScoreBar label="Hook Strength" value={ae.hookStrength} />
          <ScoreBar label="Visual Interest" value={ae.visualInterest} />
          <ScoreBar label="Pacing" value={ae.pacing} />
          <ScoreBar label="Retention Potential" value={ae.retentionPotential} />
          <ScoreBar label="Novelty" value={ae.novelty} />
          <ScoreBar label="Emotional Impact" value={ae.emotionalImpact} />
          <ScoreBar label="Memorability" value={ae.memorability} />
          <ScoreBar label="Scroll-Stopping Power" value={ae.scrollStoppingPower} />
          <ScoreBar label="Rewatchability" value={ae.rewatchability} />
          <ScoreBar label="Energy Level" value={ae.energyLevel} />
        </Category>

        <Category title="Task Specific" avg={tsAvg}>
          <ScoreBar label="Task Relevance" value={ts.taskRelevance} />
          <ScoreBar label="Classification Accuracy" value={ts.classificationAccuracy} />
          <ScoreBar label="Technique Quality" value={ts.techniqueQuality} />
          <ScoreBar label="Timing Accuracy" value={ts.timingAccuracy} />
          <ScoreBar label="Completion Quality" value={ts.completionQuality} />
          <ScoreBar label="Success Probability" value={ts.successProbability} />
          <ScoreBar label="Goal Alignment" value={ts.goalAlignment} />
          <ScoreBar label="Ranking Score" value={ts.rankingScore} />
        </Category>

        <Category title="Audio Analysis" avg={auAvg}>
          <ScoreBar label="Speech Presence" value={au.speechPresence} />
          <ScoreBar label="Speech Clarity" value={au.speechClarity} />
          <ScoreBar label="Background Noise" value={au.backgroundNoiseLevel} negative />
          <ScoreBar label="Music Presence" value={au.musicPresence} />
          <ScoreBar label="Sound Effects" value={au.soundEffectPresence} />
          <ScoreBar label="A/V Sync" value={au.audioVisualSync} />
          <ScoreBar label="Rhythm Alignment" value={au.rhythmAlignment} />
          <ScoreBar label="Tone Match" value={au.toneMatch} />
        </Category>

        <Category title="Model Confidence" avg={coAvg}>
          <ScoreBar label="Model Confidence" value={co.modelConfidence} />
          <ScoreBar label="Prediction Entropy" value={co.predictionEntropy} negative />
          <ScoreBar label="Ambiguity" value={co.ambiguityScore} negative />
          <ScoreBar label="Missing Data Rate" value={co.missingDataRate} negative />
          <ScoreBar label="Boundary Confidence" value={co.boundaryConfidence} />
          <ScoreBar label="Cross-Frame Consistency" value={co.crossFrameConsistency} />
          <ScoreBar label="Reliability Score" value={co.reliabilityScore} />
        </Category>
      </div>

      <div className="border-t border-[#CFBB92] pt-3 dark:border-[#6B5240]/50">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#4A3220]/80 dark:text-[#F8F0E2]/70">
          Safety / Moderation
        </p>
        <div className="grid gap-1 sm:grid-cols-2">
          <ScoreBar label="NSFW Risk" value={safety.nsfwRisk} negative />
          <ScoreBar label="Violence Risk" value={safety.violenceRisk} negative />
          <ScoreBar label="Privacy Risk" value={safety.privacyRisk} negative />
          <ScoreBar label="Harmful Content" value={safety.harmfulContentRisk} negative />
          <ScoreBar label="Illegal Content" value={safety.illegalContentRisk} negative />
          <ScoreBar label="Face Sensitivity" value={safety.faceSensitivity} negative />
          <ScoreBar label="Moderation Penalty" value={safety.moderationPenalty} negative />
        </div>
      </div>
    </div>
  );
}
