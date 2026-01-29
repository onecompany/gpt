import React, { useRef, useEffect } from "react";
import { Renderer, Program, Mesh, Color, Triangle } from "ogl";

export const Iridescence: React.FC = () => {
  const ctnDom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ctnDom.current) return;
    const ctn = ctnDom.current;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: `attribute vec2 uv;attribute vec2 position;varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,0,1);}`,
      fragment: `precision highp float;uniform float uTime;uniform vec3 uColor;uniform vec3 uResolution;varying vec2 vUv;void main(){vec2 uv=(vUv.xy*2.-1.)*uResolution.xy/min(uResolution.x,uResolution.y);float d=-uTime*0.5;float a=0.;for(float i=0.;i<8.;++i){a+=cos(i-d-a*uv.x);d+=sin(uv.y*i+a);}d+=uTime*0.5;vec3 col=vec3(cos(uv*vec2(d,a))*.6+.4,cos(a+d)*.5+.5);col=cos(col*cos(vec3(d,a,2.5))*.5+.5)*uColor;gl_FragColor=vec4(col,1.);}`,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Color(0.3, 0.2, 0.5) },
        uResolution: {
          value: new Color(
            gl.canvas.width,
            gl.canvas.height,
            gl.canvas.width / gl.canvas.height,
          ),
        },
      },
    });

    const resize = () => {
      if (!ctn) return;
      renderer.setSize(ctn.offsetWidth, ctn.offsetHeight);
      if (program)
        program.uniforms.uResolution.value = new Color(
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height,
        );
    };
    window.addEventListener("resize", resize, false);

    const mesh = new Mesh(gl, { geometry, program });
    let animateId: number;
    const update = (t: number) => {
      animateId = requestAnimationFrame(update);
      program.uniforms.uTime.value = t * 0.0005;
      renderer.render({ scene: mesh });
    };
    animateId = requestAnimationFrame(update);
    ctn.appendChild(gl.canvas);
    resize();
    return () => {
      cancelAnimationFrame(animateId);
      window.removeEventListener("resize", resize);
      if (ctn?.contains(gl.canvas)) ctn.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);
  return (
    <div
      ref={ctnDom}
      className="absolute inset-0 -z-10 opacity-20 mask-[radial-gradient(ellipse_at_center,black_50%,transparent_80%)]"
    />
  );
};
