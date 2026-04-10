// ViewModel.ts

export type CourseStatus = 'locked' | 'available' | 'selected' | 'moveUpTarget';

export interface CourseViewModel {
    id: string;
    name: string;
    grade: string;

    status: CourseStatus;
    isSelected: boolean;
    isInvalidSelection: boolean;
    
    // Explicit Move-Up flags
    isMoveUpSource: boolean;
    isMoveUpTarget: boolean;
    
    moveUpSourceId?: string; // If this is a target, who is the source
    moveUpTargetId?: string; // If this is a source, who is the target
    
    moveUpAvailable?: boolean; // If it's possible to move up from this course

    lockReason?: string;
    moveUpNote?: string;
    crowdRating: number;
}