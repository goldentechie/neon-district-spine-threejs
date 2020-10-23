export class ImageCache {

  constructor() {
    this.imageLinks = {
      'ability'  : "https://neon-district-season-one.s3.amazonaws.com/assets/V5/64w/1x/Hack.png",
      'attack'   : "https://neon-district-season-one.s3.amazonaws.com/assets/V5/64w/1x/Attack.png",
      'effect'   : "https://neon-district-season-one.s3.amazonaws.com/assets/V5/64w/1x/Effect.png",
      'interact' : "https://neon-district-season-one.s3.amazonaws.com/assets/V5/64w/1x/Interact.png",
      'ndlogo'   : "https://neon-district-season-one.s3.amazonaws.com/assets/nd-logo.png"
    };
    if (!window.ndCombatImageCache) {
      window.ndCombatImageCache = {};
    }
  }

  pullImages() {
    for (let _key in this.imageLinks) {
      if (window.ndCombatImageCache.hasOwnProperty(_key)) {
        continue;
      }

      window.ndCombatImageCache[_key] = "loading...";

      this._pullImage(_key, this.imageLinks[_key]);
    }
  }

  _pullImage(_name, _url) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = (function() {
      window.ndCombatImageCache[_name] = img;
    }).bind(this);
    img.onerror = (function() {
      console.error("Could not load image for", _name, "at URL:" + _url);
      delete window.ndCombatImageCache[_name];
    }).bind(this)
    img.src = _url;
  }

  getImage(_name) {
    if (window.ndCombatImageCache.hasOwnProperty(_name)) {
      return window.ndCombatImageCache[_name];
    }

    return null;
  }

}
