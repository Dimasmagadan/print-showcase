import { frameCapacity } from './state.js';
                                                             
                                                                     
/** Cache and in-flight decode reservations share a byte budget. Fetches ≤3. */
export class RedesignFramePool {
  cache = new Map                ();
  pending = new Map                         ();
  wanted           = [];
  reservations = 0;
  peakBytes = 0;
  peakRequests = 0;
  generation = 0;
  capacity        ;
          io    ;
           width        ;
           height        ;
          ready            ;
          failed            ;
  constructor(io    , width        , height        , ready            , failed            ) {
    this.io=io; this.width=width; this.height=height; this.ready=ready; this.failed=failed;
    this.capacity = frameCapacity(width, height);
    if (this.capacity < 3) throw Error('Frame dimensions exceed budget');
  }
  get bytes() { return (this.cache.size + this.reservations) * this.width * this.height * 4; }
  get(url        ) {
    const b = this.cache.get(url);
    if (b) { this.cache.delete(url); this.cache.set(url,b); }
    return b;
  }
  plan(urls          ) {
    this.wanted = [...new Set(urls)].slice(0,this.capacity);
    for (const [url,abort] of this.pending) if (!this.wanted.includes(url)) abort.abort();
    this.pump();
  }
  trim(limit        ) {
    while (this.cache.size > Math.max(0,limit)) {
      // Prefer dropping frames outside the new direction of travel.
      const key = [...this.cache.keys()].find(k=>!this.wanted.includes(k)) ?? this.cache.keys().next().value ;
      this.cache.get(key) .close(); this.cache.delete(key);
    }
  }
  clear() {
    this.generation++; this.wanted=[];
    for (const abort of this.pending.values()) abort.abort();
    this.trim(0);
  }
  pump() {
    for (const url of this.wanted) {
      if (this.pending.size >= 3) break;
      if (this.cache.has(url) || this.pending.has(url)) continue;
      const abort = new AbortController();
      this.pending.set(url,abort);
      this.peakRequests=Math.max(this.peakRequests,this.pending.size);
      void this.load(url,abort,this.generation);
    }
  }
  async load(url        , abort                 , generation        ) {
    let reserved=false, bitmap                    ;
    const valid=()=>generation===this.generation && !abort.signal.aborted && this.wanted.includes(url);
    try {
      const r=await this.io.fetch(url,{signal:abort.signal});
      if(!r.ok) throw Error('Frame unavailable');
      const blob=await r.blob();
      if(!valid()) return;
      this.trim(this.capacity-this.reservations-1);
      this.reservations++; reserved=true;
      this.peakBytes=Math.max(this.peakBytes,this.bytes);
      bitmap=await this.io.decode(blob);
      if(!valid()) return;
      if(bitmap.width!==this.width || bitmap.height!==this.height) throw Error('Unexpected raster size');
      this.reservations--; reserved=false;
      this.cache.set(url,bitmap); bitmap=undefined;
      this.ready();
    } catch {
      if(valid()) this.failed();
    } finally {
      bitmap?.close();
      if(reserved) this.reservations--;
      this.pending.delete(url);
      this.pump();
    }
  }
}
