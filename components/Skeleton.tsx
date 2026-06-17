import React, { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface SkeletonProps {
    width?: string;
    className?: string;
    variant?: 'bar' | 'card';
    lines?: number;
}

const SkeletonBar: React.FC<Pick<SkeletonProps, 'width' | 'className'>> = ({ width = '60%', className = '' }) => {
    const shimmer = useAnimation();

    useEffect(() => {
        shimmer.start({
            x: ['-100%', '100%'],
            transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
        });
    }, [shimmer]);

    return (
        <div className={`relative h-[10px] rounded-md bg-white/[.07] ${className}`} style={{ width }}>
            <motion.div
                className="absolute inset-0 rounded-md"
                animate={shimmer}
                style={{
                    background: 'linear-gradient(100deg, transparent 20%, rgba(var(--theme-rgb), 0.10) 45%, transparent 70%)',
                }}
            />
        </div>
    );
};

const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 2 }) => {
    const widths = ['60%', '90%', '80%', '70%'];

    return (
        <div className="rounded-xl border border-white/[.08] bg-white/[.02] p-3.5">
            {Array.from({ length: lines }, (_, i) => (
                <SkeletonBar key={i} width={widths[i % widths.length]} className={i > 0 ? 'mt-2' : ''} />
            ))}
        </div>
    );
};

const Skeleton: React.FC<SkeletonProps> = ({ width, className, variant = 'bar', lines }) => {
    if (variant === 'card') return <SkeletonCard lines={lines} />;
    return <SkeletonBar width={width} className={className} />;
};

export default Skeleton;
