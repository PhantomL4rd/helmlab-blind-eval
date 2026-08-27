<script lang="ts">
let {
  candidates,
  shortlisted,
  onToggle,
}: {
  candidates: { id: string; hex: string }[];
  shortlisted: string[];
  onToggle: (dyeId: string) => void;
} = $props();
</script>

<div class="grid">
  {#each candidates as c (c.id)}
    <button
      class="cell"
      class:on={shortlisted.includes(c.id)}
      onclick={() => onToggle(c.id)}
      aria-pressed={shortlisted.includes(c.id)}
      aria-label="Dye swatch"
    >
      <span class="swatch" style:background-color={c.hex}></span>
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: 0.3rem;
  }
  .cell {
    padding: 0.2rem;
    border: 2px solid transparent;
    border-radius: 6px;
    background: none;
  }
  .cell.on {
    border-color: var(--accent);
    background: var(--panel-bg);
  }
  .swatch {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 4px;
  }
</style>
