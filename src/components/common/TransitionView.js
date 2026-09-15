import useReducedMotionPreference from '../../Utilities/useReducedMotionPreference';
import React from 'react';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';

function View({ children, className }) {
  const present = useIsPresent();
  const reduceMotion = useReducedMotionPreference();
  return <motion.div
    className={className}
    inert={present ? undefined : ''}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: reduceMotion ? 0 : .14, ease: 'easeOut' }}
  >{children}</motion.div>;
}

export default function TransitionView({ stateKey, children, className }) {
  return <AnimatePresence mode="wait" initial={false}>
    <View key={stateKey} className={className}>{children}</View>
  </AnimatePresence>;
}
