<script lang="ts">
let {
  candidates,
  ties,
  selectedDyeId,
  onOpenCompare,
}: {
  candidates: { id: string; hex: string }[];
  ties: string[];
  selectedDyeId: string | null;
  onOpenCompare: (dyeId: string) => void;
} = $props();
</script>

<div class="grid">
  {#each candidates as c (c.id)}
    <button
      class="cell"
      class:selected={c.id === selectedDyeId}
      class:tied={ties.includes(c.id)}
      onclick={() => onOpenCompare(c.id)}
      aria-label="Candidate swatch"
    >
      <span class="swatch" style:background-color={c.hex}></span>
      <span class="hex-label">{c.hex}</span>
      {#if c.id === selectedDyeId}
        <span class="badge">Selected</span>
      {:else if ties.includes(c.id)}
        <span class="badge tie">Tied</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 0.75rem;
  }
  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    padding: 0.6rem;
    border: 2px solid transparent;
    border-radius: 10px;
    background: var(--panel-bg);
  }
  .cell.selected {
    border-color: var(--accent);
  }
  .cell.tied {
    border-color: #a0a0a0;
    border-style: dashed;
  }
  .swatch {
    width: 84px;
    height: 84px;
  }
  .badge {
    font-size: 0.7rem;
    color: var(--accent);
  }
  .badge.tie {
    color: var(--ink-muted);
  }
</style>
