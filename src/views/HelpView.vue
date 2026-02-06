<template>
  <div class="help-view">
    <div class="header-placeholder">
       <div class="page-title">SYSTEM DOCUMENTATION</div>
    </div>
    <div class="content">
      <div class="doc-container">
        <h1>TRICYS Help</h1>
        <p>Welcome to the TRitium Integrated CYcle Simulation.</p>
        <h3>Quick Start</h3>
        <ul>
          <li><strong>Config:</strong> Upload your Modelica files to start.</li>
          <li><strong>Monitor:</strong> Watch real-time simulation progress.</li>
          <li><strong>Display:</strong> Analyze results and plots.</li>
        </ul>
      </div>
    </div>
  </div>
</template>



<style scoped>
.help-view { width: 100%; height: 100%; background: #05070a; color: #fff; display: flex; flex-direction: column; }
.content { flex: 1; padding: 40px; overflow-y: auto; }
.doc-container { max-width: 800px; margin: 0 auto; background: #0d1117; padding: 40px; border: 1px solid #30363d; }
.page-title { font-family: monospace; color: #666; font-weight: bold; letter-spacing: 2px; }
h1 { color: #00d2ff; }
ul { line-height: 1.6; color: #aaa; }
.header-placeholder { display: flex; align-items: center; justify-content: center; height: 60px; pointer-events: none; position: absolute; width: 100%; top: 0; }
</style>
