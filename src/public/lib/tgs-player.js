// tgs-player.js
// Minimal TGS player lib using lottie-web and pako

(function (global) {
  // Check dependencies and load them if not present
  const loadDependency = (src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const loadDependencies = async () => {
    const promises = [];
    if (!global.lottie) {
      promises.push(loadDependency('https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.10.2/lottie.min.js'));
    }
    if (!global.pako) {
      promises.push(loadDependency('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js'));
    }
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  };

  // Initialize the player after dependencies are loaded
  loadDependencies().then(() => {
    console.log('TgsPlayer loaded');

    function TgsPlayer(container, tgsUrl, options = {}) {
      if (typeof container === "string") {
        container = document.querySelector(container);
      }
      if (!container) {
        throw new Error("Container element not found");
      }
      this.container = container;
      this.tgsUrl = tgsUrl;
      this.options = options;
      this.animation = null;
    }

    TgsPlayer.prototype.load = async function () {
      // Clear any existing content
      this.container.innerHTML = '';

      const response = await fetch(this.tgsUrl);
      if (!response.ok) throw new Error(`Failed to load ${this.tgsUrl}`);

      const buffer = await response.arrayBuffer();
      const decompressedStr = pako.inflate(new Uint8Array(buffer), { to: "string" });
      const animationData = JSON.parse(decompressedStr);

      this.animation = lottie.loadAnimation({
        container: this.container,
        renderer: this.options.renderer || "svg",
        loop: this.options.loop !== undefined ? this.options.loop : true,
        autoplay: this.options.autoplay !== undefined ? this.options.autoplay : true,
        animationData,
      });
    };

    TgsPlayer.prototype.destroy = function () {
      if (this.animation) {
        this.animation.destroy();
        this.animation = null;
      }
      // Clear the container
      if (this.container) {
        this.container.innerHTML = '';
      }
    };

    // Define custom element
    class TgsElement extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        if (this.hasAttribute('class')) {
          container.className = this.getAttribute('class');
        }
        this.shadowRoot.appendChild(container);
        // this.player = new TgsPlayer(container, this.getAttribute('src'));
      }

      connectedCallback() {
        this.player.load();
      }

      disconnectedCallback() {
        this.player.destroy();
      }

      static get observedAttributes() {
        return ['src', 'class'];
      }

      attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'src' && oldValue !== newValue) {
          console.log('src changed here');
          this.player.destroy();
          this.player = new TgsPlayer(this.shadowRoot.firstElementChild, newValue);
          this.player.load();
        } else if (name === 'class' && oldValue !== newValue) {
          this.shadowRoot.firstElementChild.className = newValue;
        }
      }
    }

    // Register custom element
    if (!customElements.get('mood-pal')) {
      customElements.define('mood-pal', TgsElement);
    }

    // Expose globally
    global.TgsPlayer = TgsPlayer;
  });
})(window);
