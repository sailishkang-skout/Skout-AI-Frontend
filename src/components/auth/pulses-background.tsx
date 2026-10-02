"use client";

import { useEffect, useRef } from "react";

/**
 * Hairline strands carrying travelling light packets, drawn in one fragment shader. Written for
 * the auth pages; the look (Sunset palette, 3 strands) was picked from the strands motion lab.
 * No dependencies: a single full-screen triangle on a WebGL1 canvas. Without WebGL the canvas is
 * never created and the dark base behind it shows.
 */

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

const FRAG = `precision highp float;
uniform float t;uniform vec2 r;uniform vec2 m;uniform vec3 c0,c1,c2;
uniform float glow,count,amp;
vec3 pal(float k){k=fract(k)*3.;return k<1.?mix(c0,c1,k):(k<2.?mix(c1,c2,k-1.):mix(c2,c0,k-2.));}
vec3 bgc(vec2 p){return vec3(.022,.016,.06)+vec3(.05,.03,.14)*smoothstep(1.2,0.,length(p*vec2(.7,1.2)));}
float lean(vec2 p,vec2 mm){vec2 d=p-mm;return exp(-dot(d,d)*7.);}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*r)/r.y;
  vec3 col=vec3(0.);
  float env=smoothstep(1.35,.2,abs(p.x));
  for(int i=0;i<7;i++){
    if(float(i)>=count)break;
    float fi=float(i);float ph=fi*1.9;
    float yc=amp*(.17*sin(p.x*1.7+t*.4+ph)+.08*sin(p.x*3.7-t*.7+ph*1.3)+.03*sin(p.x*8.+t*1.3+ph))*env+(fi-count*.5+.5)*.06;
    yc+=(m.y-yc)*lean(vec2(p.x,yc),m)*.5;
    float d=abs(p.y-yc);float th=.0022;
    float line=th/(d+th*.6);line*=line*.5;
    float flow=p.x*.55-t*(.18+fi*.045)+fi*.31;
    float pk=fract(flow);float packet=exp(-pk*9.)*smoothstep(0.,.02,pk);
    float pk2=fract(flow*1.7+.4);float packet2=exp(-pk2*14.)*smoothstep(0.,.02,pk2)*.6;
    float pulse=packet+packet2;
    vec3 c=pal(fi/count+p.x*.1);
    col+=c*line*.5*env;
    col+=c*exp(-d/(.003+pulse*.005))*pulse*1.5*env;
    col+=vec3(1.)*exp(-d*d/(.000012))*pulse*.8*env;
  }
  col=1.-exp(-col*glow*1.2);
  col+=bgc(p);
  gl_FragColor=vec4(col,1.);
}`;

type Props = {
  /** Three hex colours cycled along each strand. */
  colors?: [string, string, string];
  strands?: number;
  speed?: number;
  glow?: number;
  reach?: number;
  className?: string;
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function PulsesBackground({
  colors = ["#f97316", "#7c3aed", "#06b6d4"],
  strands = 3,
  speed = 1.35,
  glow = 0.9,
  reach = 1.4,
  className,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%";
    const gl = canvas.getContext("webgl", { antialias: false });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    host.appendChild(canvas);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const attr = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(attr);
    gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const [c0, c1, c2] = colors.map(hexToRgb);
    gl.uniform3fv(u("c0"), c0);
    gl.uniform3fv(u("c1"), c1);
    gl.uniform3fv(u("c2"), c2);
    gl.uniform1f(u("glow"), glow);
    gl.uniform1f(u("count"), strands);
    gl.uniform1f(u("amp"), reach);

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pointer.tx = (e.clientX - r.left - r.width / 2) / Math.max(1, r.height);
      pointer.ty = -(e.clientY - r.top - r.height / 2) / Math.max(1, r.height);
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    let raf = 0;
    let time = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = 0;
      if (!visible) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt * speed * (reduceMotion ? 0.15 : 1);
      pointer.x += (pointer.tx - pointer.x) * 0.07;
      pointer.y += (pointer.ty - pointer.y) * 0.07;

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.round(host.clientWidth * dpr);
      const h = Math.round(host.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(u("t"), time);
      gl.uniform2f(u("r"), canvas.width, canvas.height);
      gl.uniform2f(u("m"), pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (raf || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      start();
    });
    io.observe(host);
    const onVisibility = () => {
      visible = !document.hidden;
      start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      visible = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onMove);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
    // Tuning props are constants captured once at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} aria-hidden className={className} />;
}
