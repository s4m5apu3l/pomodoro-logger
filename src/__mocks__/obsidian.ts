// Mock Obsidian API for testing

export class Plugin {
  app: any;
  manifest: any;
  
  async loadData(): Promise<any> {
    return {};
  }
  
  async saveData(data: any): Promise<void> {}
  
  addCommand(command: any): void {}
  
  registerView(viewType: string, viewCreator: (leaf: WorkspaceLeaf) => ItemView): void {}
  
  async onload(): Promise<void> {}
  
  async onunload(): Promise<void> {}
}

export class Notice {
  constructor(public message: string, public duration?: number) {}
}

export class Vault {
  adapter: any;
}

export class WorkspaceLeaf {
  view: ItemView | null = null;
}

export abstract class ItemView {
  app: any;
  leaf: WorkspaceLeaf;
  containerEl: HTMLElement;
  
  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.containerEl = document.createElement('div');
  }
  
  abstract getViewType(): string;
  abstract getDisplayText(): string;
  abstract getIcon(): string;
  
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
  
  onResize(): void {}
}

export function setIcon(el: HTMLElement, icon: string): void {
  el.setAttribute('data-icon', icon);
}
