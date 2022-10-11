export const __SPEC__ = 'undefined' === typeof window;
export const __BROWSER__ = !__SPEC__;

type top = number;
type right = number;
type bottom = number;
type left = number;

type width = number;
type height = number;
type scale = number;

export type SIZE = [width, height];
export type POINT = [left, top];
export type OFFSET = [top, right, bottom, left];

export type SIZE_WITH_SCALE = [width, height, scale];
export type POINT_WITH_SCALE = [left, top, scale];

export type END_LISTENER = (() => void) | undefined;
