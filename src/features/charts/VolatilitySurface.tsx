import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Grid } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Enhanced Volatility Surface with realistic option pricing visualization
 * Shows implied volatility across strikes and expirations
 */

interface VolatilitySurfaceMeshProps {
    baseVol: number;
    atmSkew: number;
}

const VolatilitySurfaceMesh: React.FC<VolatilitySurfaceMeshProps> = ({ baseVol = 0.3, atmSkew = 0.1 }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const wireframeRef = useRef<THREE.Mesh>(null);

    // Generate volatility surface data
    const geometry = useMemo(() => {
        const width = 60;
        const depth = 60;
        const widthSegments = 40;
        const depthSegments = 40;

        const geo = new THREE.PlaneGeometry(width, depth, widthSegments, depthSegments);
        const positions = geo.attributes.position!.array;
        const colors = new Float32Array(positions.length);

        // Strike range: -30% to +30% (0 = ATM)
        // Time range: 0 to 60 days
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i]!; // Strike (moneyness)
            const z = positions[i + 2]!; // Time to expiration

            // Normalize
            const strike = x / 30; // -1 to 1
            const timeToExpiry = (z + 30) / 60; // 0 to 1

            // SVI Volatility Smile Model
            const atmVol = baseVol * (1 + 0.2 * Math.sqrt(timeToExpiry));
            const skewTerm = atmSkew * strike;
            const smileTerm = 0.08 * strike * strike; // Convexity
            const termStructure = 0.15 * timeToExpiry;

            const impliedVol = atmVol + skewTerm + smileTerm + termStructure;
            const height = impliedVol * 100; // Scale for visibility

            positions[i + 1] = height;

            // Color based on volatility
            const normalized = (impliedVol - baseVol) / (baseVol * 0.5);
            const hue = 0.55 - normalized * 0.35; // Blue (0.55) to Red (0.2)
            const color = new THREE.Color().setHSL(Math.max(0, Math.min(1, hue)), 0.8, 0.5);
            colors[i] = color.r;
            colors[i + 1] = color.g;
            colors[i + 2] = color.b;
        }

        geo.attributes.position!.needsUpdate = true;
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        return geo;
    }, [baseVol, atmSkew]);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
        }
    });

    return (
        <group rotation={[-Math.PI / 3, 0, 0]} position={[0, -10, 0]}>
            {/* Main surface */}
            <mesh ref={meshRef} geometry={geometry}>
                <meshStandardMaterial
                    vertexColors
                    side={THREE.DoubleSide}
                    metalness={0.3}
                    roughness={0.4}
                    emissive={new THREE.Color(0x001a33)}
                    emissiveIntensity={0.2}
                />
            </mesh>

            {/* Wireframe overlay */}
            <mesh ref={wireframeRef} geometry={geometry}>
                <meshBasicMaterial
                    color={new THREE.Color(0x00ff9d)}
                    wireframe
                    transparent
                    opacity={0.15}
                />
            </mesh>

            {/* Grid floor */}
            <Grid
                args={[60, 60]}
                position={[0, -0.5, 0]}
                cellSize={6}
                cellThickness={0.5}
                cellColor="#00ff9d"
                sectionSize={12}
                sectionThickness={1}
                sectionColor="#00ccff"
                fadeDistance={80}
                fadeStrength={1}
            />

            {/* Axis labels */}
            <Text
                position={[-35, 0, 0]}
                rotation={[0, 0, 0]}
                fontSize={3}
                color="#00ff9d"
                anchorX="left"
            >
                OTM Puts
            </Text>
            <Text
                position={[35, 0, 0]}
                rotation={[0, 0, 0]}
                fontSize={3}
                color="#00ff9d"
                anchorX="right"
            >
                OTM Calls
            </Text>
            <Text
                position={[0, 0, -35]}
                rotation={[0, 0, 0]}
                fontSize={3}
                color="#00ccff"
                anchorX="center"
            >
                Near Term
            </Text>
            <Text
                position={[0, 0, 35]}
                rotation={[0, 0, 0]}
                fontSize={3}
                color="#00ccff"
                anchorX="center"
            >
                Far Term
            </Text>
        </group>
    );
};

interface VolatilitySurfaceProps {
    baseVol?: number;
    skew?: number;
}

const VolatilitySurface: React.FC<VolatilitySurfaceProps> = ({ baseVol = 0.35, skew = 0.0 }) => {
    // Convert metrics to usable parameters
    const atmSkew = Math.max(-0.3, Math.min(0.3, skew * 0.1));
    const normalizedVol = Math.max(0.1, Math.min(1.0, baseVol || 0.35));

    // Calculate Skew Metric: (IV_25_Put - IV_25_Call) / IV_ATM
    // Approximate based on our SVI model parameters
    // Put Strike = -0.5 (normalized), Call Strike = 0.5
    const ivAtm = normalizedVol;
    const ivPut = normalizedVol + (atmSkew * -0.5) + (0.08 * 0.25);
    const ivCall = normalizedVol + (atmSkew * 0.5) + (0.08 * 0.25);
    const skewMetric = (ivPut - ivCall) / ivAtm;

    const sentiment = skewMetric > 0.1 ? 'FEAR (Puts Expensive)' :
        skewMetric < -0.1 ? 'FOMO (Calls Expensive)' : 'NEUTRAL';

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
            <Canvas
                camera={{ position: [0, 50, 80], fov: 45 }}
                gl={{ alpha: false, antialias: true }}
                style={{ background: '#000' }}
            >
                {/* Lighting */}
                <ambientLight intensity={0.4} />
                <directionalLight position={[10, 10, 5]} intensity={0.8} />
                <pointLight position={[-10, -10, -10]} intensity={0.3} color="#00ff9d" />
                <pointLight position={[10, 10, 10]} intensity={0.3} color="#00ccff" />

                {/* Volatility Surface */}
                <VolatilitySurfaceMesh baseVol={normalizedVol} atmSkew={atmSkew} />

                {/* Controls */}
                <OrbitControls
                    enableDamping
                    dampingFactor={0.05}
                    rotateSpeed={0.5}
                    minDistance={30}
                    maxDistance={150}
                    minPolarAngle={0}
                    maxPolarAngle={Math.PI / 2}
                />
            </Canvas>

            {/* Info overlay */}
            <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                right: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'var(--font-mono)',
                pointerEvents: 'none'
            }}>
                <div>
                    <div>ATM Vol: {(normalizedVol * 100).toFixed(1)}%</div>
                    <div>Skew: {(skewMetric * 100).toFixed(1)}%</div>
                    <div style={{
                        color: skewMetric > 0.1 ? 'var(--accent-danger)' :
                            skewMetric < -0.1 ? 'var(--accent-primary)' : 'var(--text-muted)',
                        fontWeight: 'bold',
                        marginTop: '2px'
                    }}>
                        {sentiment}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div>Model: SVI</div>
                    <div style={{ color: 'var(--accent-primary)' }}>🔄 Live</div>
                </div>
            </div>

            {/* Color legend */}
            <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(0,0,0,0.7)',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid rgba(0,255,157,0.3)',
                fontSize: '9px',
                color: '#fff',
                fontFamily: 'var(--font-mono)'
            }}>
                <div style={{ marginBottom: '4px', fontWeight: '600' }}>IMPLIED VOL</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <div style={{ width: '10px', height: '10px', background: '#ff0055', borderRadius: '2px' }} />
                    <span>High</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <div style={{ width: '10px', height: '10px', background: '#ffaa00', borderRadius: '2px' }} />
                    <span>Medium</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', background: '#00ccff', borderRadius: '2px' }} />
                    <span>Low</span>
                </div>
            </div>
        </div>
    );
};

export default VolatilitySurface;
