'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * The bingo cage, in real 3D.
 *
 * A wireframe globe of lat/long lines (matching the logo), balls tumbling
 * inside it, a stand and a crank — and the caller stood beside it with a hand
 * on the handle, turning it. Every time a ball is drawn the cage kicks into a
 * faster spin that decays back to its idle drift.
 *
 * The caller's face is loaded from /host.png. Drop the avatar there; if the
 * file is missing the scene falls back to a plain green disc so nothing breaks.
 */

const BALL_COUNT = 16;
const CAGE_RADIUS = 1.55;

export interface CageSceneProps {
  /** Bump this on every new ball to kick the spin. */
  spinKey?: number;
  /** Idle drift multiplier — 0 parks the cage. */
  speed?: number;
  className?: string;
}

export function CageScene({ spinKey = 0, speed = 1, className = '' }: CageSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const kickRef = useRef(0);
  const speedRef = useRef(speed);

  // Kick the spin whenever a ball drops, without re-creating the scene.
  useEffect(() => {
    kickRef.current = 1;
  }, [spinKey]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    // Framed so the cage sits left of centre with the caller beside it.
    camera.position.set(1.05, 0.45, 8.4);
    camera.lookAt(0.95, -0.25, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    // --- lighting ---------------------------------------------------------
    scene.add(new THREE.AmbientLight(0xd9ffe9, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(3, 5, 5);
    scene.add(key);
    const rim = new THREE.PointLight(0x5be49b, 26, 18);
    rim.position.set(-3, 1.5, 3);
    scene.add(rim);

    // --- the cage ---------------------------------------------------------
    const cageGroup = new THREE.Group();
    scene.add(cageGroup);

    // Clean lat/long lines, like the logo. A wireframe sphere would give us
    // triangles; these are real circles.
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x5be49b,
      transparent: true,
      opacity: 0.85,
    });

    function circle(radius: number): THREE.BufferGeometry {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
      }
      return new THREE.BufferGeometry().setFromPoints(points);
    }

    // Meridians — vertical slices around the pole.
    for (let i = 0; i < 6; i++) {
      const meridian = new THREE.Line(circle(CAGE_RADIUS), lineMat);
      meridian.rotation.y = (i / 6) * Math.PI;
      cageGroup.add(meridian);
    }

    // Parallels — horizontal rings up the sphere.
    for (const frac of [-0.66, -0.36, 0, 0.36, 0.66]) {
      const y = CAGE_RADIUS * frac;
      const r = Math.sqrt(Math.max(0, CAGE_RADIUS * CAGE_RADIUS - y * y));
      const parallel = new THREE.Line(circle(r), lineMat);
      parallel.rotation.x = Math.PI / 2;
      parallel.position.y = y;
      cageGroup.add(parallel);
    }

    // Faint glass shell so the cage reads as a volume, not just lines.
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(CAGE_RADIUS * 0.995, 32, 24),
      new THREE.MeshPhongMaterial({
        color: 0x24c37a,
        transparent: true,
        opacity: 0.09,
        shininess: 90,
        side: THREE.DoubleSide,
      }),
    );
    cageGroup.add(shell);

    // The equator band and the little hub, straight off the logo.
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(CAGE_RADIUS * 1.01, 0.035, 10, 64),
      new THREE.MeshPhongMaterial({ color: 0x86efac, shininess: 60 }),
    );
    band.rotation.x = Math.PI / 2;
    cageGroup.add(band);

    const hub = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.2),
      new THREE.MeshPhongMaterial({ color: 0x86efac, shininess: 70 }),
    );
    hub.position.z = CAGE_RADIUS * 0.62;
    hub.position.y = CAGE_RADIUS * 0.34;
    cageGroup.add(hub);

    // --- balls inside -----------------------------------------------------
    const ballGeo = new THREE.SphereGeometry(0.2, 18, 14);
    const ballMats = [
      new THREE.MeshPhongMaterial({ color: 0xf3fbf6, shininess: 100, specular: 0x9affc9 }),
      new THREE.MeshPhongMaterial({ color: 0x86efac, shininess: 100, specular: 0xffffff }),
      new THREE.MeshPhongMaterial({ color: 0x5be49b, shininess: 100, specular: 0xffffff }),
    ];

    /**
     * The balls swirl on stable pseudo-orbits rather than falling under
     * gravity. Free-fall looked right for a second and then every ball piled
     * up in the same spot at the bottom, reading as one lump — orbits keep the
     * cage looking full and busy at any spin speed.
     */
    interface Ball {
      mesh: THREE.Mesh;
      radius: number;
      phase: number;
      incline: number;
      rate: number;
      bobPhase: number;
    }
    const balls: Ball[] = [];
    for (let i = 0; i < BALL_COUNT; i++) {
      const mesh = new THREE.Mesh(ballGeo, ballMats[i % ballMats.length]);
      cageGroup.add(mesh);
      // Spread deterministically via the golden angle so they never clump.
      const golden = i * 2.399963;
      balls.push({
        mesh,
        radius: CAGE_RADIUS * (0.42 + ((i * 7) % 10) / 10 * 0.42),
        phase: golden,
        // Bias the orbits low in the cage, like balls resting on the spin.
        incline: -0.62 + ((i * 5) % 9) / 9 * 1.15,
        rate: 0.7 + ((i * 3) % 7) / 7 * 0.7,
        bobPhase: golden * 1.7,
      });
    }

    // --- stand + crank ----------------------------------------------------
    const frameMat = new THREE.MeshPhongMaterial({ color: 0x5be49b, shininess: 70 });

    // Legs run outside the sphere and lean in to meet the axle height.
    const legGeo = new THREE.CylinderGeometry(0.055, 0.055, 2.3, 12);
    for (const x of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(x * 1.42, -1.28, 0);
      leg.rotation.z = x * 0.16;
      scene.add(leg);
    }

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.13, 0.75), frameMat);
    base.position.y = -2.42;
    scene.add(base);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.12, 0.98), frameMat);
    plinth.position.y = -2.55;
    scene.add(plinth);

    // Crank: an axle, an arm and a handle, all turning together.
    const crank = new THREE.Group();
    crank.position.set(1.62, 0, 0);
    scene.add(crank);

    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10), frameMat);
    axle.rotation.z = Math.PI / 2;
    axle.position.x = -0.2;
    crank.add(axle);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.09), frameMat);
    arm.position.y = 0.28;
    crank.add(arm);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 12), frameMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.2, 0.56, 0);
    crank.add(handle);

    // --- the caller -------------------------------------------------------
    const callerGroup = new THREE.Group();
    callerGroup.position.set(2.95, -0.85, 0.55);
    callerGroup.scale.setScalar(0.76);
    scene.add(callerGroup);

    // Body: a little rounded torso the avatar sits on.
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.44, 0.5, 8, 20),
      new THREE.MeshPhongMaterial({ color: 0x16a362, shininess: 50 }),
    );
    body.position.y = -0.78;
    callerGroup.add(body);

    // Head: a disc carrying the avatar texture, ringed in brand green.
    const headRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.06, 12, 48),
      new THREE.MeshPhongMaterial({ color: 0x5be49b, shininess: 80 }),
    );
    callerGroup.add(headRing);

    const headMat = new THREE.MeshBasicMaterial({ color: 0x5be49b, side: THREE.DoubleSide });
    const head = new THREE.Mesh(new THREE.CircleGeometry(0.7, 48), headMat);
    head.position.z = 0.01;
    callerGroup.add(head);

    // Swap in the real avatar once it loads. Failure is fine — the green disc
    // is a perfectly good stand-in.
    const loader = new THREE.TextureLoader();
    loader.load(
      '/host.png',
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        headMat.map = texture;
        headMat.color.set(0xffffff);
        headMat.needsUpdate = true;
      },
      undefined,
      () => {
        /* no avatar yet — keep the placeholder */
      },
    );

    // The arm reaching over to the crank handle.
    const callerArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.085, 0.9, 6, 12),
      new THREE.MeshPhongMaterial({ color: 0x5be49b, shininess: 60 }),
    );
    callerArm.position.set(-0.72, -0.6, 0.25);
    callerArm.rotation.z = Math.PI / 2.6;
    callerGroup.add(callerArm);

    // --- resize -----------------------------------------------------------
    function resize(): void {
      const { clientWidth, clientHeight } = mount!;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      // Pull the camera back on narrow screens so nothing gets clipped.
      camera.fov = clientWidth < 480 ? 46 : 38;
      camera.updateProjectionMatrix();
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    // --- animation --------------------------------------------------------
    const clock = new THREE.Clock();
    let frame = 0;
    let running = true;

    // Pause when scrolled out of view — no reason to burn a GPU on an
    // off-screen canvas.
    const visibility = new IntersectionObserver(
      ([entry]) => {
        running = entry?.isIntersecting ?? true;
        if (running) clock.getDelta(); // drop the accumulated gap
      },
      { threshold: 0.01 },
    );
    visibility.observe(mount);

    function tick(): void {
      frame = requestAnimationFrame(tick);
      if (!running) return;

      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // Spin: a steady drift plus a decaying kick after each ball.
      kickRef.current = Math.max(0, kickRef.current - dt * 1.1);
      const kick = kickRef.current * kickRef.current; // ease out
      const rate = reduceMotion ? 0 : speedRef.current * (0.42 + kick * 4.2);

      cageGroup.rotation.y += dt * rate;
      cageGroup.rotation.x = Math.sin(t * 0.35) * 0.08;
      crank.rotation.z -= dt * rate * 2.4;

      // Caller bobs, and leans in a touch harder while the cage is spinning up.
      if (!reduceMotion) {
        callerGroup.position.y = -0.55 + Math.sin(t * 1.8) * 0.045;
        callerGroup.rotation.z = Math.sin(t * 1.8) * 0.035 - kick * 0.06;
        callerArm.rotation.z = Math.PI / 2.6 + Math.sin(-crank.rotation.z) * 0.16;
      }

      // Balls swirl inside the cage, faster while it's spinning up.
      for (const ball of balls) {
        ball.phase += dt * ball.rate * (0.55 + rate * 1.5);
        const bob = Math.sin(t * 1.3 + ball.bobPhase) * 0.16;
        const y = ball.radius * ball.incline + bob;
        // Keep the orbit on the sphere's cross-section at this height.
        const ring = Math.sqrt(Math.max(0.04, ball.radius * ball.radius - y * y));
        ball.mesh.position.set(
          Math.cos(ball.phase) * ring,
          y,
          Math.sin(ball.phase) * ring,
        );
        ball.mesh.rotation.x += dt * 2;
        ball.mesh.rotation.y += dt * 1.4;
      }

      renderer.render(scene, camera);
    }
    tick();

    // --- teardown ---------------------------------------------------------
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry.dispose();
          const mat = obj.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      headMat.map?.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
