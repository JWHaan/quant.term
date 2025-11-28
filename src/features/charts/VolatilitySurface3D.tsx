import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface VolatilitySurface3DProps {
    data: { strike: number; expiry: number; vol: number }[];
    width?: number;
    height?: number;
}

const Surface: React.FC<{ data: { strike: number; expiry: number; vol: number }[] }> = ({ data }) => {
    const geometry = useMemo(() => {
        if (data.length === 0) return new THREE.PlaneGeometry(1, 1);

        // Normalize data
        const strikes = data.map(d => d.strike);
        const expiries = data.map(d => d.expiry);
        const vols = data.map(d => d.vol);

        const minStrike = Math.min(...strikes);
        const maxStrike = Math.max(...strikes);
        const minExpiry = Math.min(...expiries);
        const maxExpiry = Math.max(...expiries);
        const minVol = Math.min(...vols);
        const maxVol = Math.max(...vols);

        // Create grid
        const size = Math.sqrt(data.length); // Assuming square grid for simplicity
        const geo = new THREE.PlaneGeometry(10, 10, size - 1, size - 1);
        const pos = geo.attributes.position;

        if (pos) {
            for (let i = 0; i < pos.count; i++) {
                const d = data[i];
                if (d) {
                    // Map to -5 to 5 range
                    const x = ((d.strike - minStrike) / (maxStrike - minStrike)) * 10 - 5;
                    const z = ((d.expiry - minExpiry) / (maxExpiry - minExpiry)) * 10 - 5;
                    const y = ((d.vol - minVol) / (maxVol - minVol)) * 5;

                    pos.setXYZ(i, x, y, z);
                }
            }
        }

        geo.computeVertexNormals();
        return geo;
    }, [data]);

    return (
        <mesh geometry={geometry}>
            <meshStandardMaterial color="orange" wireframe={false} side={THREE.DoubleSide} />
        </mesh>
    );
};

export const VolatilitySurface3D: React.FC<VolatilitySurface3DProps> = ({
    data,
    width = 600,
    height = 400
}) => {
    return (
        <div style={{ width, height, backgroundColor: '#1e293b', borderRadius: '8px' }}>
            <Canvas camera={{ position: [10, 10, 10], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                <Surface data={data} />
                <OrbitControls />
                <gridHelper args={[20, 20]} />
                <axesHelper args={[5]} />
                {/* Labels could be added with <Text> */}
            </Canvas>
        </div>
    );
};
