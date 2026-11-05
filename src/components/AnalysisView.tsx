import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter, ArrowUpRight, Bold, Circle as CircleIcon, FilePlus2, ImagePlus, Italic, List, ListOrdered,
  Minus, MousePointer2, PenLine, Redo2, Square, Trash2, Underline, Undo2,
} from 'lucide-react';
import type { AnalysisPage, AnalysisShape } from '../types/journal';
import type { JournalSyncStatus } from '../hooks/useSupabaseJournal';

type ImageFrame = { left: number; top: number; width: number; height: number };
type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type DrawTool = 'pen' | 'line' | 'arrow' | 'circle' | 'rectangle';
type DrawMode = DrawTool | 'select';
type DrawPoint = { x: number; y: number };
interface AnalysisViewProps { pages: AnalysisPage[]; setPages: React.Dispatch<React.SetStateAction<AnalysisPage[]>>; syncStatus: JournalSyncStatus }
const todayDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const makePage = (title = 'Untitled analysis', date = todayDate()): AnalysisPage => ({
  id: `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title,
  date,
  content: '',
  shapes: [],
  updatedAt: new Date().toISOString(),
});

const compressImage = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read this image.'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('This image format could not be opened.'));
    image.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('Could not prepare this image.'));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    image.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

export const AnalysisView: React.FC<AnalysisViewProps> = ({ pages, setPages, syncStatus }) => {
  const [activeId, setActiveId] = useState('');
  const [drawingTool, setDrawingTool] = useState<DrawMode | null>(null);
  const [drawingColor, setDrawingColor] = useState('#e30613');
  const [drawingWidth, setDrawingWidth] = useState(3);
  const [draftShape, setDraftShape] = useState<AnalysisShape | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [shapePreview, setShapePreview] = useState<AnalysisShape | null>(null);
  const [editorSize, setEditorSize] = useState({ width: 1000, height: 700 });
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [imageIsFree, setImageIsFree] = useState(false);
  const [imageWidth, setImageWidth] = useState(100);
  const [imageHeight, setImageHeight] = useState('');
  const [imageFrame, setImageFrame] = useState<ImageFrame | null>(null);
  const [saveMessage, setSaveMessage] = useState('Syncing with Supabase');
  const editorRef = useRef<HTMLDivElement>(null);
  const editorFrameRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dragImageRef = useRef<{ image: HTMLImageElement; startX: number; startY: number; left: number; top: number } | null>(null);
  const resizeImageRef = useRef<{ image: HTMLImageElement; direction: ResizeDirection; startX: number; startY: number; width: number; height: number; left: number; top: number } | null>(null);
  const drawingPointerRef = useRef(false);
  const moveShapeRef = useRef<{ shape: AnalysisShape; startX: number; startY: number } | null>(null);
  const resizeShapeRef = useRef<{ shape: AnalysisShape; direction: ResizeDirection; startX: number; startY: number; left: number; top: number; width: number; height: number } | null>(null);
  const activePage = pages.find((page) => page.id === activeId) ?? pages[0];

  useEffect(() => {
    if (syncStatus === 'saving') setSaveMessage('Syncing with Supabase');
    else if (syncStatus === 'error') setSaveMessage('Cloud sync failed');
    else if (syncStatus === 'saved') setSaveMessage('Saved to Supabase');
    else setSaveMessage(syncStatus === 'ready' ? 'Connected to Supabase' : 'Loading from Supabase');
  }, [syncStatus]);

  useEffect(() => {
    if (editorRef.current && activePage) editorRef.current.innerHTML = activePage.content;
    setSelectedImage(null);
    setImageIsFree(false);
    setImageFrame(null);
    setSelectedShapeId(null);
    setShapePreview(null);
    setDrawingTool(null);
    if (editorRef.current) editorRef.current.style.minHeight = '';
    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const lowestEdge = Array.from(editor.querySelectorAll<HTMLImageElement>('img[style*="position: absolute"]')).reduce((max, image) => {
        const top = Number.parseFloat(image.style.top) || 0;
        return Math.max(max, top + image.offsetHeight + 48);
      }, 0);
      if (lowestEdge) editor.style.minHeight = `${Math.max(window.innerHeight * 0.58, lowestEdge)}px`;
    });
  }, [activePage?.id]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const updateSize = () => setEditorSize({ width: Math.max(1, editor.clientWidth), height: Math.max(1, editor.scrollHeight) });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(editor);
    return () => observer.disconnect();
  }, [activePage?.id]);

  const updateActivePage = (update: Partial<AnalysisPage>) => {
    if (!activePage) return;
    setPages((current) => current.map((page) => page.id === activePage.id ? { ...page, ...update, updatedAt: new Date().toISOString() } : page));
  };

  const syncEditor = () => updateActivePage({ content: editorRef.current?.innerHTML ?? '' });

  const updateImageFrame = (image = selectedImage) => {
    const frame = editorFrameRef.current;
    if (!frame || !image) return setImageFrame(null);
    const frameRect = frame.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    setImageFrame({ left: imageRect.left - frameRect.left, top: imageRect.top - frameRect.top, width: imageRect.width, height: imageRect.height });
  };

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditor();
  };

  const insertIdeaPrompts = () => runCommand('insertHTML', '<h2>Trade idea</h2><p><strong>Thesis</strong> — What is the setup and why does it matter?</p><p><strong>Key levels</strong> — Where are entry, invalidation, and target?</p><p><strong>What would change my mind?</strong> —</p><p><strong>Review</strong> — What did I learn?</p><p><br></p>');

  const addPage = () => {
    const page = makePage(`Analysis ${pages.length + 1}`, activePage?.date ?? todayDate());
    setPages((current) => [...current, page]);
    setActiveId(page.id);
  };

  const deletePage = () => {
    if (!activePage) return;
    const remaining = pages.filter((page) => page.id !== activePage.id);
    if (!remaining.length) {
      const replacement = makePage('Trade ideas');
      setPages([replacement]);
      setActiveId(replacement.id);
    } else {
      setPages(remaining);
      setActiveId(remaining[0].id);
    }
  };

  const insertImage = (image: string, alt: string) => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, `<p><img src="${image}" alt="${alt.replaceAll('"', '&quot;')}" /></p><p><br></p>`);
    syncEditor();
    const inserted = editorRef.current?.querySelectorAll('img');
    const imageElement = inserted?.[inserted.length - 1] ?? null;
    if (imageElement) selectImage(imageElement);
  };

  const selectImage = (image: HTMLImageElement | null) => {
    if (selectedImage) selectedImage.classList.remove('analysis-image-selected');
    setSelectedImage(image);
    setImageIsFree(image?.style.position === 'absolute');
    if (!image) { setImageFrame(null); return; }
    image.classList.add('analysis-image-selected');
    setImageWidth(Math.min(100, Math.max(20, Number.parseInt(image.style.width, 10) || 100)));
    setImageHeight(image.style.height && image.style.height !== 'auto' ? String(Number.parseInt(image.style.height, 10) || '') : '');
    requestAnimationFrame(() => updateImageFrame(image));
  };

  const resizeSelectedImage = (width: number, height = imageHeight) => {
    if (!selectedImage) return;
    selectedImage.style.width = `${width}%`;
    selectedImage.style.height = height ? `${height}px` : 'auto';
    setImageWidth(width);
    setImageHeight(height);
    updateImageFrame(selectedImage);
    syncEditor();
  };

  const alignSelectedImage = (alignment: 'left' | 'center' | 'right') => {
    if (!selectedImage) return;
    selectedImage.style.display = 'block';
    selectedImage.style.marginLeft = alignment === 'right' ? 'auto' : '0';
    selectedImage.style.marginRight = alignment === 'left' ? 'auto' : alignment === 'center' ? 'auto' : '0';
    updateImageFrame(selectedImage);
    syncEditor();
  };

  const removeSelectedImage = () => {
    selectedImage?.remove();
    selectImage(null);
    syncEditor();
  };

  const toggleFreeMove = () => {
    if (!selectedImage || !editorRef.current) return;
    const editor = editorRef.current;
    if (selectedImage.style.position === 'absolute') {
      selectedImage.style.position = '';
      selectedImage.style.left = '';
      selectedImage.style.top = '';
      selectedImage.style.zIndex = '';
      selectedImage.style.cursor = '';
      selectedImage.style.touchAction = '';
      selectedImage.style.margin = '';
      editor.style.minHeight = '';
      setImageIsFree(false);
    } else {
      const editorRect = editor.getBoundingClientRect();
      const imageRect = selectedImage.getBoundingClientRect();
      const left = Math.max(0, imageRect.left - editorRect.left - editor.clientLeft + editor.scrollLeft);
      const top = Math.max(0, imageRect.top - editorRect.top - editor.clientTop + editor.scrollTop);
      selectedImage.style.position = 'absolute';
      selectedImage.style.left = `${left}px`;
      selectedImage.style.top = `${top}px`;
      selectedImage.style.margin = '0';
      selectedImage.style.cursor = 'move';
      selectedImage.style.touchAction = 'none';
      editor.style.minHeight = `${Math.max(editor.clientHeight, top + selectedImage.offsetHeight + 48)}px`;
      setImageIsFree(true);
    }
    requestAnimationFrame(() => updateImageFrame(selectedImage));
    syncEditor();
  };

  const beginImageMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || image.style.position !== 'absolute') return;
    event.preventDefault();
    image.setPointerCapture(event.pointerId);
    dragImageRef.current = {
      image,
      startX: event.clientX,
      startY: event.clientY,
      left: Number.parseFloat(image.style.left) || 0,
      top: Number.parseFloat(image.style.top) || 0,
    };
  };

  const moveImage = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragImageRef.current;
    const editor = editorRef.current;
    if (!drag || !editor) return;
    const maxLeft = Math.max(0, editor.clientWidth - drag.image.offsetWidth);
    const left = Math.max(0, Math.min(maxLeft, drag.left + event.clientX - drag.startX));
    const top = Math.max(0, drag.top + event.clientY - drag.startY);
    drag.image.style.left = `${left}px`;
    drag.image.style.top = `${top}px`;
    editor.style.minHeight = `${Math.max(window.innerHeight * 0.58, top + drag.image.offsetHeight + 48)}px`;
    updateImageFrame(drag.image);
  };

  const finishImageMove = () => {
    if (!dragImageRef.current) return;
    dragImageRef.current = null;
    syncEditor();
  };

  const beginImageResize = (event: React.PointerEvent<HTMLButtonElement>, direction: ResizeDirection) => {
    if (!selectedImage) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeImageRef.current = {
      image: selectedImage,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      width: selectedImage.getBoundingClientRect().width,
      height: selectedImage.getBoundingClientRect().height,
      left: imageFrame?.left ?? 0,
      top: imageFrame?.top ?? 0,
    };
  };

  const resizeImageFromHandle = (event: React.PointerEvent<Element>) => {
    const drag = resizeImageRef.current;
    const editor = editorRef.current;
    if (!drag || !editor) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const horizontal = drag.direction.includes('e') ? 1 : drag.direction.includes('w') ? -1 : 0;
    const vertical = drag.direction.includes('s') ? 1 : drag.direction.includes('n') ? -1 : 0;
    const widthRatio = Math.max(0.15, (drag.width + dx * horizontal) / drag.width);
    const heightRatio = Math.max(0.15, (drag.height + dy * vertical) / drag.height);
    const ratio = horizontal && vertical ? Math.max(widthRatio, heightRatio) : horizontal ? widthRatio : heightRatio;
    const newWidth = Math.max(48, drag.width * ratio);
    const newHeight = Math.max(36, drag.height * ratio);
    const maxWidth = editor.clientWidth;
    const widthPercent = Math.min(100, (newWidth / maxWidth) * 100);
    drag.image.style.width = `${widthPercent}%`;
    drag.image.style.height = `${newHeight}px`;
    if (drag.image.style.position === 'absolute') {
      const left = drag.direction.includes('w') ? drag.left + drag.width - newWidth : drag.left;
      const top = drag.direction.includes('n') ? drag.top + drag.height - newHeight : drag.top;
      drag.image.style.left = `${Math.max(0, Math.min(maxWidth - newWidth, left))}px`;
      drag.image.style.top = `${Math.max(0, top)}px`;
      editor.style.minHeight = `${Math.max(window.innerHeight * 0.58, top + newHeight + 48)}px`;
    }
    setImageWidth(Math.round(widthPercent));
    setImageHeight(String(Math.round(newHeight)));
    updateImageFrame(drag.image);
  };

  const finishImageResize = () => {
    if (!resizeImageRef.current) return;
    resizeImageRef.current = null;
    syncEditor();
  };

  const beginShapeResize = (event: React.PointerEvent<HTMLButtonElement>, direction: ResizeDirection) => {
    if (!selectedShape || !shapeFrame) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeShapeRef.current = { shape: selectedShape, direction, startX: event.clientX, startY: event.clientY, ...shapeFrame };
  };

  const resizeSelectedShape = (event: React.PointerEvent<Element>) => {
    const drag = resizeShapeRef.current;
    if (!drag || !editorRef.current) return;
    const editorWidth = Math.max(1, editorSize.width);
    const editorHeight = Math.max(1, editorSize.height);
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const left = drag.direction.includes('w') ? Math.max(0, Math.min(drag.left + drag.width - 8, drag.left + dx)) : drag.left;
    const right = drag.direction.includes('e') ? Math.max(left + 8, Math.min(editorWidth, drag.left + drag.width + dx)) : drag.left + drag.width;
    const top = drag.direction.includes('n') ? Math.max(0, Math.min(drag.top + drag.height - 8, drag.top + dy)) : drag.top;
    const bottom = drag.direction.includes('s') ? Math.max(top + 8, drag.top + drag.height + dy) : drag.top + drag.height;
    const oldLeft = drag.left;
    const oldTop = drag.top;
    const oldWidth = Math.max(1, drag.width);
    const oldHeight = Math.max(1, drag.height);
    const newWidth = Math.max(1, right - left);
    const newHeight = Math.max(1, bottom - top);
    const transformPoint = (point: DrawPoint): DrawPoint => {
      const px = (point.x / 100) * editorWidth;
      const py = (point.y / 100) * editorHeight;
      return {
        x: ((left + ((px - oldLeft) / oldWidth) * newWidth) / editorWidth) * 100,
        y: ((top + ((py - oldTop) / oldHeight) * newHeight) / editorHeight) * 100,
      };
    };
    setShapePreview(mapShapePoints(drag.shape, transformPoint));
  };

  const finishShapeResize = () => {
    const drag = resizeShapeRef.current;
    const resized = shapePreview;
    if (drag && resized && activePage) setPages((current) => current.map((page) => page.id === activePage.id ? { ...page, shapes: (page.shapes ?? []).map((shape) => shape.id === drag.shape.id ? resized : shape), updatedAt: new Date().toISOString() } : page));
    resizeShapeRef.current = null;
    setShapePreview(null);
  };

  const updateSelectedShape = (update: Partial<AnalysisShape>) => {
    if (!selectedShape || !activePage) return;
    setPages((current) => current.map((page) => page.id === activePage.id ? { ...page, shapes: (page.shapes ?? []).map((shape) => shape.id === selectedShape.id ? { ...shape, ...update } : shape), updatedAt: new Date().toISOString() } : page));
  };

  const deleteSelectedShape = () => {
    if (!selectedShape || !activePage) return;
    setPages((current) => current.map((page) => page.id === activePage.id ? { ...page, shapes: (page.shapes ?? []).filter((shape) => shape.id !== selectedShape.id), updatedAt: new Date().toISOString() } : page));
    setSelectedShapeId(null);
  };

  const drawingPoint = (event: React.PointerEvent<SVGSVGElement>): DrawPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100)),
    };
  };

  const startPageDrawing = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingTool || !activePage) return;
    const target = event.target instanceof SVGElement ? event.target.closest<SVGElement>('[data-shape-id]') : null;
    const clickedShapeId = target?.dataset.shapeId;
    if (drawingTool === 'select') {
      event.preventDefault();
      if (!clickedShapeId) { setSelectedShapeId(null); return; }
      const shape = (activePage.shapes ?? []).find((item) => item.id === clickedShapeId);
      if (!shape) return;
      setSelectedShapeId(shape.id);
      event.currentTarget.setPointerCapture(event.pointerId);
      moveShapeRef.current = { shape, startX: event.clientX, startY: event.clientY };
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedShapeId(null);
    drawingPointerRef.current = true;
    const point = drawingPoint(event);
    setDraftShape({ id: 'draft-shape', type: drawingTool, start: point, end: point, points: drawingTool === 'pen' ? [point] : undefined, color: drawingColor, width: drawingWidth });
  };

  const movePageDrawing = (event: React.PointerEvent<SVGSVGElement>) => {
    const moving = moveShapeRef.current;
    if (moving && activePage) {
      const dx = ((event.clientX - moving.startX) / Math.max(1, editorSize.width)) * 100;
      const dy = ((event.clientY - moving.startY) / Math.max(1, editorSize.height)) * 100;
      const bounds = getShapeBounds(moving.shape);
      const safeDx = Math.max(-bounds.left, Math.min(100 - bounds.right, dx));
      const safeDy = Math.max(-bounds.top, Math.min(100 - bounds.bottom, dy));
      setShapePreview(mapShapePoints(moving.shape, (point) => ({ x: point.x + safeDx, y: point.y + safeDy })));
      return;
    }
    if (!drawingPointerRef.current || !draftShape) return;
    const point = drawingPoint(event);
    setDraftShape((current) => current ? {
      ...current,
      end: point,
      points: current.type === 'pen' ? [...(current.points ?? []), point] : current.points,
    } : current);
  };

  const finishPageDrawing = () => {
    if (moveShapeRef.current) {
      const movedShape = shapePreview;
      const original = moveShapeRef.current.shape;
      if (movedShape && activePage) setPages((current) => current.map((page) => page.id === activePage.id ? { ...page, shapes: (page.shapes ?? []).map((shape) => shape.id === original.id ? movedShape : shape), updatedAt: new Date().toISOString() } : page));
      moveShapeRef.current = null;
      setShapePreview(null);
      return;
    }
    drawingPointerRef.current = false;
    if (!draftShape || !activePage) { setDraftShape(null); return; }
    const moved = Math.abs(draftShape.end.x - draftShape.start.x) + Math.abs(draftShape.end.y - draftShape.start.y) > 0.3;
    if (moved) {
      const shape = { ...draftShape, id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
      setPages((current) => current.map((page) => page.id === activePage.id ? { ...page, shapes: [...(page.shapes ?? []), shape], updatedAt: new Date().toISOString() } : page));
    }
    setDraftShape(null);
  };

  const pageShapes = (activePage?.shapes ?? []).map((shape) => shapePreview?.id === shape.id ? shapePreview : shape).concat(draftShape ? [draftShape] : []);
  const getShapeBounds = (shape: AnalysisShape) => {
    const points = shape.type === 'pen' ? (shape.points?.length ? shape.points : [shape.start, shape.end]) : [shape.start, shape.end];
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
  };
  const mapShapePoints = (shape: AnalysisShape, mapPoint: (point: DrawPoint) => DrawPoint): AnalysisShape => ({
    ...shape,
    start: mapPoint(shape.start),
    end: mapPoint(shape.end),
    points: shape.points?.map(mapPoint),
  });
  const selectedShape = pageShapes.find((shape) => shape.id === selectedShapeId && shape.id !== 'draft-shape');
  const selectedBounds = selectedShape ? getShapeBounds(selectedShape) : null;
  const shapeFrame = selectedBounds ? {
    left: (selectedBounds.left / 100) * editorSize.width - Math.max(0, 10 - ((selectedBounds.right - selectedBounds.left) / 100) * editorSize.width) / 2,
    top: (selectedBounds.top / 100) * editorSize.height - Math.max(0, 10 - ((selectedBounds.bottom - selectedBounds.top) / 100) * editorSize.height) / 2,
    width: Math.max(10, ((selectedBounds.right - selectedBounds.left) / 100) * editorSize.width),
    height: Math.max(10, ((selectedBounds.bottom - selectedBounds.top) / 100) * editorSize.height),
  } : null;
  const renderPageShape = (shape: AnalysisShape) => {
    const x1 = (shape.start.x / 100) * editorSize.width;
    const y1 = (shape.start.y / 100) * editorSize.height;
    const x2 = (shape.end.x / 100) * editorSize.width;
    const y2 = (shape.end.y / 100) * editorSize.height;
    const common = { stroke: shape.color, strokeWidth: shape.width, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, vectorEffect: 'non-scaling-stroke' as const };
    if (shape.type === 'pen') {
      const points = (shape.points ?? [shape.start, shape.end]).map((point) => `${(point.x / 100) * editorSize.width},${(point.y / 100) * editorSize.height}`).join(' ');
      return <g key={shape.id} data-shape-id={shape.id}><polyline points={points} fill="none" stroke="transparent" strokeWidth={Math.max(shape.width + 16, 20)} pointerEvents="stroke" /><polyline points={points} {...common} /></g>;
    }
    if (shape.type === 'circle') return <g key={shape.id} data-shape-id={shape.id}><ellipse cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} rx={Math.abs(x2 - x1) / 2} ry={Math.abs(y2 - y1) / 2} fill="transparent" pointerEvents="all" /><ellipse cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} rx={Math.abs(x2 - x1) / 2} ry={Math.abs(y2 - y1) / 2} {...common} /></g>;
    if (shape.type === 'rectangle') return <g key={shape.id} data-shape-id={shape.id}><rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} fill="transparent" pointerEvents="all" /><rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} {...common} /></g>;
    return <g key={shape.id} data-shape-id={shape.id}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={Math.max(shape.width + 16, 20)} pointerEvents="stroke" /><line x1={x1} y1={y1} x2={x2} y2={y2} {...common} markerEnd={shape.type === 'arrow' ? `url(#${shape.id}-arrowhead)` : undefined} /></g>;
  };

  const changeImageLayer = (direction: 'front' | 'back') => {
    if (!selectedImage) return;
    const images = Array.from(editorRef.current?.querySelectorAll<HTMLImageElement>('img[style*="position: absolute"]') ?? []);
    const layers = images.map((image) => Number.parseInt(image.style.zIndex, 10) || 0);
    selectedImage.style.zIndex = String(direction === 'front' ? Math.max(0, ...layers) + 1 : Math.min(0, ...layers) - 1);
    syncEditor();
  };

  const addScreenshot = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      insertImage(await compressImage(file), file.name.replace(/[<>]/g, ''));
      setSaveMessage('Screenshot added');
    } catch {
      setSaveMessage('Could not add that screenshot');
    }
  };

  const ToolbarButton = ({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) => (
    <button type="button" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-transparent px-2 text-on-surface-variant transition-colors hover:border-outline-variant hover:bg-surface-container hover:text-on-surface">{children}</button>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:gap-space-lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-caption-mono text-caption-mono uppercase tracking-widest text-tertiary">Your workspace</p><h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Analysis</h1><p className="mt-1 text-on-surface-variant">Build trade ideas, annotate charts, and keep your review notes together.</p></div>
        <div className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-low px-3 py-2 font-caption-mono text-[11px] text-tertiary"><span className="h-2 w-2 rounded-full bg-success" />{saveMessage}</div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-space-md lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
          <div className="mb-3 flex items-center justify-between"><span className="font-caption-mono text-caption-mono font-semibold uppercase tracking-widest text-tertiary">Pages</span><button type="button" onClick={addPage} className="rounded-full border border-outline-variant p-2 text-on-surface-variant hover:bg-surface-container" aria-label="Add page" title="Add page"><FilePlus2 size={16} /></button></div>
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {pages.map((page, index) => <button key={page.id} type="button" onClick={() => setActiveId(page.id)} className={`min-w-36 rounded-xl border px-3 py-3 text-left transition-colors lg:min-w-0 ${page.id === activePage?.id ? 'border-primary/40 bg-surface-container text-on-surface' : 'border-transparent text-on-surface-variant hover:bg-surface-container-low'}`}><span className="mb-1 block font-caption-mono text-[10px] uppercase tracking-widest text-tertiary">{new Date(`${page.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · Page {String(index + 1).padStart(2, '0')}</span><span className="block truncate text-sm font-semibold">{page.title || 'Untitled analysis'}</span></button>)}
          </div>
        </aside>

        {activePage && <section className="min-w-0 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-6">
            <input aria-label="Page title" value={activePage.title} onChange={(event) => updateActivePage({ title: event.target.value })} placeholder="Untitled analysis" className="min-w-48 flex-1 bg-transparent font-headline-md text-headline-md font-bold text-on-surface outline-none placeholder:text-tertiary" />
            <label className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-caption-mono text-[10px] uppercase tracking-wider text-tertiary">Date<input aria-label="Analysis page date" type="date" value={activePage.date} onChange={(event) => updateActivePage({ date: event.target.value || todayDate() })} className="min-w-0 bg-transparent text-sm normal-case tracking-normal text-on-surface outline-none" /></label>
            <button type="button" onClick={deletePage} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs text-tertiary hover:bg-error-container/30 hover:text-secondary" title="Delete this page"><Trash2 size={15} />Delete page</button>
          </header>

          <div className="flex flex-wrap items-center gap-1 border-b border-outline-variant bg-surface-container-low/70 px-3 py-2" role="toolbar" aria-label="Page formatting">
            <ToolbarButton label="Undo" onClick={() => runCommand('undo')}><Undo2 size={16} /></ToolbarButton><ToolbarButton label="Redo" onClick={() => runCommand('redo')}><Redo2 size={16} /></ToolbarButton><span className="mx-1 h-6 w-px bg-outline-variant" />
            <ToolbarButton label="Bold" onClick={() => runCommand('bold')}><Bold size={16} /></ToolbarButton><ToolbarButton label="Italic" onClick={() => runCommand('italic')}><Italic size={16} /></ToolbarButton><ToolbarButton label="Underline" onClick={() => runCommand('underline')}><Underline size={16} /></ToolbarButton>
            <select aria-label="Text size" defaultValue="3" onChange={(event) => runCommand('fontSize', event.target.value)} className="h-9 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 text-sm text-on-surface"><option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">Title</option></select>
            <label title="Text color" className="flex h-9 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs text-on-surface-variant hover:bg-surface-container">A<input aria-label="Text color" type="color" defaultValue="#111111" onChange={(event) => runCommand('foreColor', event.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" /></label>
            <span className="mx-1 h-6 w-px bg-outline-variant" /><ToolbarButton label="Bulleted list" onClick={() => runCommand('insertUnorderedList')}><List size={16} /></ToolbarButton><ToolbarButton label="Numbered list" onClick={() => runCommand('insertOrderedList')}><ListOrdered size={16} /></ToolbarButton><ToolbarButton label="Center align" onClick={() => runCommand('justifyCenter')}><AlignCenter size={16} /></ToolbarButton><ToolbarButton label="Divider" onClick={() => runCommand('insertHTML', '<hr><p><br></p>')}><Minus size={16} /></ToolbarButton>
            <span className="mx-1 h-6 w-px bg-outline-variant" />
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={insertIdeaPrompts} className="rounded-lg px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">Idea prompts</button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"><ImagePlus size={15} />Screenshot</button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={addScreenshot} />
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { selectImage(null); setDrawingTool((tool) => tool ? null : 'select'); }} aria-pressed={!!drawingTool} className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold ${drawingTool ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}><PenLine size={15} />{drawingTool ? 'Drawing tools on' : 'Draw on page'}</button>
          </div>

          {drawingTool && <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant bg-surface-container-low px-4 py-3 sm:px-6">
            <span className="mr-1 font-caption-mono text-[10px] font-semibold uppercase tracking-widest text-tertiary">Choose a tool</span>
            {([
              ['select', 'Select', <MousePointer2 size={15} />],
              ['pen', 'Pen', <PenLine size={15} />], ['line', 'Line', <Minus size={15} />],
              ['arrow', 'Arrow', <ArrowUpRight size={15} />], ['circle', 'Circle', <CircleIcon size={15} />],
              ['rectangle', 'Rectangle', <Square size={15} />],
            ] as [DrawMode, string, React.ReactNode][]).map(([tool, label, icon]) => <button key={tool} type="button" onClick={() => setDrawingTool(tool)} aria-pressed={drawingTool === tool} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${drawingTool === tool ? 'border-primary/40 bg-surface-container-high text-on-surface' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'}`}>{icon}{label}</button>)}
            {drawingTool !== 'select' && <><label className="flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 text-xs text-on-surface-variant">Color<input aria-label="Drawing color" type="color" value={drawingColor} onChange={(event) => setDrawingColor(event.target.value)} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" /></label>
            <label className="flex items-center gap-2 rounded-full border border-outline-variant px-3 py-1.5 text-xs text-on-surface-variant">Weight<input aria-label="Drawing line weight" type="range" min="1" max="8" value={drawingWidth} onChange={(event) => setDrawingWidth(Number(event.target.value))} /></label>
            <button type="button" onClick={() => { if (window.confirm('Clear all drawings from this page?')) { setPages((current) => current.map((page) => page.id === activePage.id ? { ...page, shapes: [], updatedAt: new Date().toISOString() } : page)); setSelectedShapeId(null); } }} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-tertiary hover:text-secondary"><Trash2 size={14} />Clear</button></>}
            <button type="button" onClick={() => { setDrawingTool(null); setDraftShape(null); }} className="ml-auto rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary">Done</button>
            <span className="basis-full text-[11px] text-tertiary">{drawingTool === 'select' ? 'Select a drawing to move it or resize it using the handles.' : `Click and drag on the page to place your ${drawingTool}.`}</span>
          </div>}

          {selectedShape && <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant bg-surface-container-low/50 px-4 py-3 sm:px-6">
            <span className="font-caption-mono text-[10px] font-semibold uppercase tracking-widest text-tertiary">Selected {selectedShape.type}</span>
            <label className="flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 text-xs text-on-surface-variant">Color<input aria-label="Selected drawing color" type="color" value={selectedShape.color} onChange={(event) => updateSelectedShape({ color: event.target.value })} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" /></label>
            <label className="flex items-center gap-2 rounded-full border border-outline-variant px-3 py-1.5 text-xs text-on-surface-variant">Weight<input aria-label="Selected drawing line weight" type="range" min="1" max="12" value={selectedShape.width} onChange={(event) => updateSelectedShape({ width: Number(event.target.value) })} /></label>
            <button type="button" onClick={deleteSelectedShape} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-secondary hover:bg-error-container/30"><Trash2 size={14} />Delete drawing</button>
          </div>}

          {selectedImage && <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant bg-surface-container-low/50 px-4 py-3 sm:px-6">
            <span className="font-caption-mono text-[10px] font-semibold uppercase tracking-widest text-tertiary">Selected image</span>
            <button type="button" onClick={toggleFreeMove} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${imageIsFree ? 'border-primary/40 bg-surface-container text-on-surface' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>{imageIsFree ? 'In text flow' : 'Move freely'}</button>
            <label className="flex min-w-44 flex-1 items-center gap-2 text-xs text-on-surface-variant">Width <input type="range" min="20" max="100" value={imageWidth} onChange={(event) => resizeSelectedImage(Number(event.target.value))} className="min-w-20 flex-1 accent-primary" /><span className="w-10 text-right font-caption-mono">{imageWidth}%</span></label>
            <label className="flex items-center gap-2 text-xs text-on-surface-variant">Height <input type="number" min="60" max="2000" value={imageHeight} onChange={(event) => resizeSelectedImage(imageWidth, event.target.value)} placeholder="Auto" className="w-20 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-on-surface" /><span>px</span></label>
            {!imageIsFree && <div className="flex items-center gap-1" aria-label="Image alignment">
              {(['left', 'center', 'right'] as const).map((alignment) => <button key={alignment} type="button" onClick={() => alignSelectedImage(alignment)} className="rounded-lg border border-outline-variant px-2 py-1.5 text-[10px] uppercase text-on-surface-variant hover:bg-surface-container">{alignment}</button>)}
            </div>}
            {imageIsFree && <div className="flex items-center gap-1"><button type="button" onClick={() => changeImageLayer('back')} className="rounded-lg border border-outline-variant px-2 py-1.5 text-[10px] text-on-surface-variant hover:bg-surface-container">Send back</button><button type="button" onClick={() => changeImageLayer('front')} className="rounded-lg border border-outline-variant px-2 py-1.5 text-[10px] text-on-surface-variant hover:bg-surface-container">Bring front</button></div>}
            <button type="button" onClick={removeSelectedImage} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-secondary hover:bg-error-container/30"><Trash2 size={14} />Remove</button>
          </div>}

          <div ref={editorFrameRef} className="relative">
            <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={syncEditor} onPointerDown={beginImageMove} onPointerMove={(event) => { moveImage(event); resizeImageFromHandle(event); }} onPointerUp={(event) => { finishImageMove(); finishImageResize(); }} onPointerCancel={(event) => { finishImageMove(); finishImageResize(); }} onClick={(event) => { const target = event.target; selectImage(target instanceof HTMLImageElement ? target : null); }} data-placeholder="Write your idea, paste notes, or add a chart screenshot…" className="analysis-editor-content min-h-[58vh] px-5 py-6 text-on-surface outline-none sm:px-10 sm:py-9" aria-label="Analysis page editor" />
            <svg className="analysis-drawing-layer" width={editorSize.width} height={editorSize.height} viewBox={`0 0 ${editorSize.width} ${editorSize.height}`} style={{ width: editorSize.width, height: editorSize.height, pointerEvents: drawingTool ? 'auto' : 'none' }} onPointerDown={startPageDrawing} onPointerMove={movePageDrawing} onPointerUp={finishPageDrawing} onPointerCancel={finishPageDrawing} aria-label="On-page drawing layer">
              <defs>{pageShapes.filter((shape) => shape.type === 'arrow').map((shape) => <marker key={`${shape.id}-marker`} id={`${shape.id}-arrowhead`} markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 10 5 L 0 10 z" fill={shape.color} /></marker>)}</defs>
              {pageShapes.map(renderPageShape)}
            </svg>
            {selectedShape && shapeFrame && <div className="analysis-image-frame" role="group" aria-label="Drawing resize handles" style={{ left: shapeFrame.left, top: shapeFrame.top, width: shapeFrame.width, height: shapeFrame.height }}>
              {([
                ['nw', 'left-0 top-0 cursor-nwse-resize'], ['n', 'left-1/2 top-0 cursor-ns-resize'], ['ne', 'right-0 top-0 cursor-nesw-resize'],
                ['e', 'right-0 top-1/2 cursor-ew-resize'], ['se', 'right-0 bottom-0 cursor-nwse-resize'], ['s', 'left-1/2 bottom-0 cursor-ns-resize'],
                ['sw', 'left-0 bottom-0 cursor-nesw-resize'], ['w', 'left-0 top-1/2 cursor-ew-resize'],
              ] as [ResizeDirection, string][]).map(([direction, classes]) => <button key={direction} type="button" tabIndex={-1} aria-label={`Resize drawing ${direction}`} onPointerDown={(event) => beginShapeResize(event, direction)} onPointerMove={resizeSelectedShape} onPointerUp={finishShapeResize} onPointerCancel={finishShapeResize} className={`analysis-image-handle ${classes}`} />)}
            </div>}
            {selectedImage && imageFrame && <div className="analysis-image-frame" role="group" aria-label="Image resize handles" style={{ left: imageFrame.left, top: imageFrame.top, width: imageFrame.width, height: imageFrame.height }}>
              {([
                ['nw', 'left-0 top-0 cursor-nwse-resize'], ['n', 'left-1/2 top-0 cursor-ns-resize'], ['ne', 'right-0 top-0 cursor-nesw-resize'],
                ['e', 'right-0 top-1/2 cursor-ew-resize'], ['se', 'right-0 bottom-0 cursor-nwse-resize'], ['s', 'left-1/2 bottom-0 cursor-ns-resize'],
                ['sw', 'left-0 bottom-0 cursor-nesw-resize'], ['w', 'left-0 top-1/2 cursor-ew-resize'],
              ] as [ResizeDirection, string][]).map(([direction, classes]) => <button key={direction} type="button" tabIndex={-1} aria-label={`Resize image ${direction}`} onPointerDown={(event) => beginImageResize(event, direction)} onPointerMove={resizeImageFromHandle} onPointerUp={finishImageResize} onPointerCancel={finishImageResize} className={`analysis-image-handle ${classes}`} />)}
            </div>}
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant px-4 py-3 font-caption-mono text-[10px] uppercase tracking-wider text-tertiary sm:px-6"><span>Formatting, screenshots, and sketches are saved with this page</span><span>Updated {new Date(activePage.updatedAt).toLocaleString()}</span></footer>
        </section>}
      </div>
    </div>
  );
};
