<script lang="ts">
let {
  targetHex,
  candidateHex,
  isTied,
  onConfirm,
  onToggleTie,
  onClose,
}: {
  targetHex: string;
  candidateHex: string;
  isTied: boolean;
  onConfirm: () => void;
  onToggleTie: () => void;
  onClose: () => void;
} = $props();
</script>

<div class="overlay" role="presentation" onclick={onClose}>
  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="pair">
      <div class="side">
        <span class="swatch big" style:background-color={targetHex}></span>
        <span class="hex-label">{targetHex}</span>
        <span class="caption">Target</span>
      </div>
      <div class="side">
        <span class="swatch big" style:background-color={candidateHex}></span>
        <span class="hex-label">{candidateHex}</span>
        <span class="caption">Candidate</span>
      </div>
    </div>
    <div class="actions">
      <button class="primary" onclick={onConfirm}>This is the closest</button>
      <button onclick={onToggleTie}>{isTied ? 'Remove from tied' : 'Mark as tied'}</button>
      <button onclick={onClose}>Back</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }
  .panel {
    background: var(--neutral-bg);
    border-radius: 12px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    align-items: center;
  }
  .pair {
    display: flex;
    gap: 2rem;
  }
  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
  }
  .swatch.big {
    width: 180px;
    height: 180px;
  }
  .caption {
    font-size: 0.8rem;
    color: var(--ink-muted);
  }
  .actions {
    display: flex;
    gap: 0.75rem;
  }
  .primary {
    background: var(--accent);
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    font-weight: 600;
  }
  button:not(.primary) {
    background: var(--panel-bg);
    border: 1px solid var(--border);
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
  }
</style>
