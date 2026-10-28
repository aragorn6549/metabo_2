import { useState, useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';

function Body3D({ fatIntensity, muscleIntensity, lipogenesisIntensity, netFatToday, muscleToday }) {
  const mountRef = useRef(null);
  const refs = useRef({
    target:{fat:0,muscle:0,lipo:0}, current:{fat:0,muscle:0,lipo:0},
    rotation:0, mouseDown:false, lastX:0
  });
  const initRef = useRef(false);

  useEffect(() => {
    refs.current.target = {
      fat: fatIntensity,
      muscle: muscleIntensity,
      lipo: lipogenesisIntensity || 0
    };
  }, [fatIntensity, muscleIntensity, lipogenesisIntensity]);

  useEffect(() => {
    if (initRef.current) return;
    const el = mountRef.current;
    if (!el) return;
    initRef.current = true;
    
    const scene = new THREE.Scene();
    const w = el.clientWidth || 340, h = el.clientHeight || 380;
    const camera = new THREE.PerspectiveCamera(40, w/h, 0.1, 100);
    camera.position.set(0, 0.5, 7.5); camera.lookAt(0, 0.5, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h); el.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(3,5,5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x8b5cf6, 1.0); rim.position.set(-4,2,-3); scene.add(rim);
    const fill = new THREE.PointLight(0x3b82f6, 0.7); fill.position.set(0,-2,4); scene.add(fill);

    function makeBody(material) {
      const g = new THREE.Group();
      const add = (geo, pos, scale) => {
        const m = new THREE.Mesh(geo, material);
        m.position.set(...pos); if (scale) m.scale.set(...scale); g.add(m);
      };
      add(new THREE.SphereGeometry(0.32, 32, 32), [0, 2.35, 0]);
      add(new THREE.CapsuleGeometry(0.13, 0.15, 8, 16), [0, 2.0, 0]);
      add(new THREE.SphereGeometry(0.62, 32, 32), [0, 1.15, 0], [1, 1.55, 0.72]);
      add(new THREE.SphereGeometry(0.24, 20, 20), [-0.68, 1.65, 0]);
      add(new THREE.SphereGeometry(0.24, 20, 20), [0.68, 1.65, 0]);
      add(new THREE.CapsuleGeometry(0.17, 0.55, 8, 16), [-0.82, 1.2, 0]);
      add(new THREE.CapsuleGeometry(0.17, 0.55, 8, 16), [0.82, 1.2, 0]);
      add(new THREE.CapsuleGeometry(0.14, 0.55, 8, 16), [-0.87, 0.55, 0]);
      add(new THREE.CapsuleGeometry(0.14, 0.55, 8, 16), [0.87, 0.55, 0]);
      add(new THREE.SphereGeometry(0.5, 24, 24), [0, 0.35, 0], [1.15, 0.75, 0.85]);
      add(new THREE.CapsuleGeometry(0.21, 0.6, 8, 16), [-0.28, -0.35, 0]);
      add(new THREE.CapsuleGeometry(0.21, 0.6, 8, 16), [0.28, -0.35, 0]);
      add(new THREE.CapsuleGeometry(0.17, 0.6, 8, 16), [-0.28, -1.15, 0]);
      add(new THREE.CapsuleGeometry(0.17, 0.6, 8, 16), [0.28, -1.15, 0]);
      add(new THREE.BoxGeometry(0.26, 0.14, 0.45), [-0.28, -1.7, 0.1]);
      add(new THREE.BoxGeometry(0.26, 0.14, 0.45), [0.28, -1.7, 0.1]);
      return g;
    }

    const bodyGroup = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a3449, roughness: 0.55, metalness: 0.35 });
    bodyGroup.add(makeBody(baseMat));
    const fatMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false });
    const fatBody = makeBody(fatMat); fatBody.scale.setScalar(1.025); bodyGroup.add(fatBody);
    const lipoMat = new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false });
    const lipoBody = makeBody(lipoMat); lipoBody.scale.setScalar(1.04); bodyGroup.add(lipoBody);
    const muscleMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false });
    const muscleBody = makeBody(muscleMat); muscleBody.scale.setScalar(1.055); bodyGroup.add(muscleBody);
    bodyGroup.position.y = 0.3; scene.add(bodyGroup);

    let t = 0, animId;
    const animate = () => {
      animId = requestAnimationFrame(animate); t += 0.016;
      const r = refs.current;
      r.current.fat += (r.target.fat - r.current.fat) * 0.08;
      r.current.muscle += (r.target.muscle - r.current.muscle) * 0.08;
      r.current.lipo += (r.target.lipo - r.current.lipo) * 0.08;
      fatMat.opacity = r.current.fat * (0.55 + 0.45 * Math.sin(t * 2.2)) * 0.7;
      muscleMat.opacity = r.current.muscle * (0.55 + 0.45 * Math.sin(t * 2.6 + 1)) * 0.7;
      lipoMat.opacity = r.current.lipo * (0.55 + 0.45 * Math.sin(t * 1.8 + 2)) * 0.7;
      if (!r.mouseDown) r.rotation += 0.003;
      bodyGroup.rotation.y = r.rotation;
      renderer.render(scene, camera);
    };
    animate();

    const onDown = (e) => { refs.current.mouseDown = true; refs.current.lastX = e.clientX; };
    const onMove = (e) => { if (!refs.current.mouseDown) return;
      refs.current.rotation += (e.clientX - refs.current.lastX) * 0.01; refs.current.lastX = e.clientX; };
    const onUp = () => { refs.current.mouseDown = false; };
    const onTS = (e) => { refs.current.mouseDown = true; refs.current.lastX = e.touches[0].clientX; };
    const onTM = (e) => { if (!refs.current.mouseDown) return;
      refs.current.rotation += (e.touches[0].clientX - refs.current.lastX) * 0.015; refs.current.lastX = e.touches[0].clientX; };
    const onTE = () => { refs.current.mouseDown = false; };
    const onResize = () => {
      const nw = el.clientWidth, nh = el.clientHeight;
      if (!nw || !nh) return;
      renderer.setSize(nw, nh); camera.aspect = nw/nh; camera.updateProjectionMatrix();
    };
    renderer.domElement.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    renderer.domElement.addEventListener('touchstart', onTS, { passive: true });
    window.addEventListener('touchmove', onTM, { passive: true });
    window.addEventListener('touchend', onTE);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId); renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      renderer.domElement.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      renderer.domElement.removeEventListener('touchstart', onTS);
      window.removeEventListener('touchmove', onTM);
      window.removeEventListener('touchend', onTE);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const showFatBurn = netFatToday != null && netFatToday > 0.5;
  const showFatGain = netFatToday != null && netFatToday < -0.5;

  return (
    <div className="body3d-container">
      <div ref={mountRef} style={{ width:'100%', height:'100%' }} />
      {showFatBurn && (
        <div className="floating-delta delta-fat-good" style={{ top:'24%', left:'6%', animation:'floatUp 2s ease-in-out infinite alternate' }}>
          ↓ {Math.round(Math.abs(netFatToday))}г жира
        </div>
      )}
      {showFatGain && (
        <div className="floating-delta delta-fat-bad" style={{ top:'30%', left:'6%', animation:'floatUp 2.2s ease-in-out infinite alternate' }}>
          ↑ {Math.round(Math.abs(netFatToday))}г накоплено
        </div>
      )}
      {muscleToday > 0.3 && (
        <div className="floating-delta delta-muscle" style={{ top:'58%', right:'6%', animation:'floatUp 2.4s ease-in-out infinite alternate' }}>
          ↑ {Math.round(muscleToday)}г мышц
        </div>
      )}
      <div className="drag-hint">⟲ потяни, чтобы повернуть</div>
    </div>
  );
}

export default Body3D;
