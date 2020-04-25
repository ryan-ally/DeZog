
import { Remote } from '../remotes/remotefactory';
import * as util from 'util';
import { ZxNextSpritePatternsView} from './zxnextspritepatternsview';
import {ImageConvert} from '../imageconvert';
import {WebviewPanel} from 'vscode';
import {Utility} from '../misc/utility';



/// Contains the sprite attributes in an converted form.
class SpriteData {
	/// X-Position
	public x = 0;

	/// Y-Position
	public y = 0;

	/// X-Mirroring
	public xMirrored = 0;

	/// Y-Mirroring
	public yMirrored = 0;

	/// Rotated
	public rotated = 0;

	/// Palette offset
	public paletteOffset = 0;

	/// Pattern index
	public patternIndex = 0;

	/// Visible
	public visible=false;

	/// 8bit or 4bit color pattern.
	/// undefined=8bit
	/// 1 = N6 is 1
	/// 0 = N6 is 0
	public N6: number|undefined=undefined;

	/// Anchor sprite
	public relativeSprite=false;


	/// The pngimage created from the pattern.
	public image:  Array<number>;

	/// Constructor
	constructor(attributes: Uint8Array) {
		this.x = attributes[0] + (attributes[2]&0x01)*256;
		this.y = attributes[1];
		this.xMirrored = (attributes[2] & 0b0000_1000) ? 1 : 0;
		this.yMirrored = (attributes[2] & 0b0000_0100) ? 1 : 0;
		this.rotated = (attributes[2] & 0b0000_0010) ? 1 : 0;
		this.paletteOffset = attributes[2] & 0b1111_0000;
		this.patternIndex = attributes[3] & 0b0011_1111;
		this.visible=((attributes[3]&0b1000_0000)!=0);
		// Handle Attribute[4]: Anchor sprites + 4bit sprites.
		if (attributes.length>4) {
			//attributes[4]=0b1100_0000;	// TODO: remove
			if((attributes[4]&0b1000_0000)!=0)
				this.N6=(attributes[4]&0b0100_0000)>>>6;	// N6
			this.relativeSprite=((attributes[4]&0b1100_0000)==0b0100_0000);
		}
	}

	/**
	 * Creates an image from the givven pattern.
	 * @param pattern 256 bytes, 16x16 pattern.
	 * @param palette 256 bytes, colors: rrrgggbbb
	 * @param transparentIndex The index used for transparency.
	 */
	public createImageFromPattern(pattern: Array<number>, palette: Array<number>, transparentIndex: number) {
		let usedPattern=pattern;
		// If 4bit color pattern change to use 1 byte per color
		if (this.N6 != undefined) {
			const offset=this.N6*128;	// 0 or 128
			const np=new Array<number>(256);
			for (let i=0; i<128; i++) {
				const val=pattern[i+offset];
				np[2*i]=val>>>4;
				np[2*i+1]=val&0x0F;
			}
			// Use
			usedPattern=np;
		}
		// Rotate
		if(this.rotated) {
			const np = new Array<number>(256);
			// Mirror
			let k = 0;
			for(let y=0; y<16; y++) {
				for(let x=0; x<16; x++)
					np[x*16+15-y] = usedPattern[k++];
			}
			// Use
			usedPattern = np;
		}
		// X-mirror
		if(this.xMirrored) {
			const np = new Array<number>(256);
			// Mirror
			let k = 0;
			for(let y=0; y<16; y++) {
				for(let x=0; x<16; x++)
					np[k++] = usedPattern[y*16+15-x];
			}
			// Use
			usedPattern = np;
		}
		// Y-mirror
		if(this.yMirrored) {
			const np = new Array<number>(256);
			// Mirror
			let k = 0;
			for(let y=0; y<16; y++) {
				for(let x=0; x<16; x++)
					np[k++] = usedPattern[(15-y)*16+x];
			}
			// Use
			usedPattern = np;
		}

		// Convert to gif
		this.image = ImageConvert.createGifFromArray(16, 16, usedPattern, palette, transparentIndex);
	}
}


/**
 * A Webview that shows the ZX Next sprite slots and the associated pattern with it's palette.
 * The view cannot be edited.
 *
 * The display consists of:
 * - x/y position
 * - Palette offset, mirroring, rotation.
 * - Visibility
 * - Pattern index
 * - Pattern as image
 *
 * The range of the slot indices can be chosen. Eg. "5 10" or "5 10, 17 2".
 * There exist a checkbox that allows for live update of the patterns and palettes.
 * The sprite values themselves are always updated live.
 *
 */
export class ZxNextSpritesView extends ZxNextSpritePatternsView {

	/// Contains the sprite slots to display.
	protected slotIndices: Array<number>;

	/// The sprites, i.e. 64 slots with 4 bytes attributes each
	protected sprites = Array<SpriteData|undefined>(128);

	/// The previous sprites, i.e. the values here are used to check which attribute has changed
	// so it can be printed in bold.
	protected previousSprites = Array<SpriteData|undefined>(128);

	/// Set if sprite clipping enabled.
	protected clippingEnabled = false;

	// Sprite clipping dimensions.
	protected clipXl: number;
	protected clipXr: number;
	protected clipYt: number;
	protected clipYb: number;


	/**
	 * Creates the basic panel.
	 * @param title The title to use for this view.
	 * @param slotRanges Pairs of start slot/count. If undefined all visible sprites will be chosen (on each update).
	 */
	constructor(title: string, slotRanges: Array<number>|undefined) {
		super(title, []);

		if(slotRanges) {
			// Create array with slots
			this.slotIndices = new Array<number>();
			while(true) {
				const start = slotRanges.shift();
				if(start == undefined)
					break;
				let end = slotRanges.shift() || 0;
				Utility.assert(end>0);
				end += start;
				for(let k=start; k<end; k++) {
					if(k > 63)
						break;
					this.slotIndices.push(k);
				}
			}
		}

		// Title
		Utility.assert(this.vscodePanel);
		(this.vscodePanel as WebviewPanel).title = title;
	}


	/**
	 * Retrieves all sprites info from the emulator.
	 * Then sets the slotIndices accordingly: with only the visible slots.
	 */
	protected async getAllVisibleSprites(): Promise<void> {
		// Get sprites
		const sprites=await Remote.getTbblueSprites(0, 64);
		// Loop over all sprites
		// TODO: Implement 128 (4bit) sprites
		for (let k=0; k<64; k++) {
			const attrs=sprites[k];
			// Check if visible
			let sprite;
			if (attrs[3]&0b10000000)
				sprite=new SpriteData(attrs);
			this.sprites[k]=sprite;
		}
	}


	/**
	 * Retrieves the sprites info from the emulator.
	 * @param slotIndices Array with all the slots to retrieve.
	 */
	protected async getSprites(slotIndices: Array<number>): Promise<void> {
		// Clear all sprites
		for(let k=0; k<64; k++)
			this.sprites[k]=undefined;

		// Loop over all slots
		for (const slot of this.slotIndices) {
			const sprites=await Remote.getTbblueSprites(slot, 1);
			const attrs=sprites[0];
			const sprite=new SpriteData(attrs);
			this.sprites[slot]=sprite;
		}
	}


	/**
	 * Check if clipping window is set.
	 * If YES it also retrieves the sprite clipping coordinates.
	 */
	protected async getSpritesClippingWindow(): Promise<void> {
		// Check if clippping is set (Layer priority)
		const value=await Remote.getTbblueRegister(21);
		this.clippingEnabled=(value&0x02)==0;
		if (!this.clippingEnabled) {
			return;
		}
		// Get clipping
		const clip=await Remote.getTbblueSpritesClippingWindow();
		this.clipXl=clip.xl;
		this.clipXr=clip.xr;
		this.clipYt=clip.yt;
		this.clipYb=clip.yb;
	}


	/**
	 * Retrieves the sprite patterns from the emulator.
	 * It knows which patterns to request from the loaded sprites.
	 * And it requests only that data that has not been requested before.
	 */
	protected async getSpritePatterns(): Promise<void> {
		// Get all unique patterns (do not request the same pattern twice)
		let patternSet = new Set<number>();
		for(const sprite of this.sprites) {
			if(sprite && sprite.visible) {
				const index = sprite.patternIndex;
				patternSet.add(index);
			}
		}
		// Change to array
		this.patternIds = Array.from(patternSet);

		// Call super
		await super.getSpritePatterns();

		// Set the sprite bitmaps according to pattern, palette offset, mirroring and rotation.
		const palette=ZxNextSpritePatternsView.staticGetPaletteForSelectedIndex(this.usedPalette);
		Utility.assert(palette);
		for (const sprite of this.sprites) {
			if ((!sprite)||(!sprite.visible))
				continue;
			const pattern=ZxNextSpritePatternsView.spritePatterns.get(sprite.patternIndex)!;
			Utility.assert(pattern);
			// Get palette with offset
			const offs=sprite.paletteOffset
			let usedPalette;
			if (offs==0)
				usedPalette=palette;
			else {
				const index=3*offs;
				const firstPart=palette.slice(index);
				const secondPart=palette.slice(0, index);
				usedPalette=firstPart;
				usedPalette.push(...secondPart);
			}
			sprite.createImageFromPattern(pattern, usedPalette, ZxNextSpritePatternsView.spritesPaletteTransparentIndex);
		}
	}


	/**
	 * Retrieves the memory content and displays it.
	 * @param reason The reason is a data object that contains additional information.
	 * E.g. for 'step' it contains { step: true };
	 * If 'step'==true the sprite patterns will not be generally updated for performance reasons.
	 * If 'step' not defined then all required sprite patterns will be retrieved from the
	 * emulator. I.e. if you do a "break" after letting the program run.
	 */
	public async update(reason?: any): Promise<void> {
		// Save previous data
		this.previousSprites = this.sprites;
		this.sprites = new Array<SpriteData|undefined>(64);

		// Check if all visible sprites should be shown automatically
		if(this.slotIndices) {
			// Reload sprites given by user
			await this.getSprites(this.slotIndices);
		}
		else {
			// Get all sprites to check which are visible
			await this.getAllVisibleSprites();
		}

		// Get clipping window
		await this.getSpritesClippingWindow();

		// Call super
		await super.update(reason);
	}


	/**
	 * Creates the js scripts and the UI elements.
	 */
	protected createScriptsAndButtons(): string {
		let html = super.createScriptsAndButtons();
		html +=  `
		<script>
			var zxBorderColor;
			var zxScreenBckgColor;
			var zxScreenFgColor;

			//----- To change also the background color of the screen -----
			function spriteBckgSelected() {
				// First call general function
				bckgSelected();

				// Set colors in canvas
				let selectedId = bckgSelector.selectedIndex;
				let color = bckgSelector.options[selectedId].value;
				zxScreenBckgColor = color;
				if(color == "black") {
					zxBorderColor = "gray";
					zxScreenFgColor = "white";
				}
				else if(color == "white") {
					zxBorderColor = "gray";
					zxScreenFgColor = "black";
				}
				else if(color == "gray") {
					zxBorderColor = "lightgray";
					zxScreenFgColor = "black";
				}
				drawScreen();
			}


			// Change the function called when the background dropdown is chosen.
			bckgSelector.onchange = spriteBckgSelected;
		</script>
		`;

		return html;
	}


	/**
	 * Returns a table cell (td) and inserts the first value.
	 * If first and second value are different then the cell is made bold.
	 * @param currentValue The currentvalue to show.
	 * @param prevValue The previous value.
	 */
	protected getTableTdWithBold(currentValue: any, prevValue: any): string {
		let convCurrentValue=currentValue;
		if (convCurrentValue==undefined)
			convCurrentValue='-';
		let td = ' <td>';
		td+=(currentValue==prevValue)? convCurrentValue:'<b>'+convCurrentValue + '</b>';
		td += '</td>\n';
		return td;
	}


	/**
	 * Creates one html table out of the sprites data.
	 */
	protected createHtmlTable(): string {
		const format= `
		<style>
			.classPattern {
				width:auto;
				height:2em;
			}
			.classImg {
				image-rendering:pixelated;
				width:auto;
				height:2em;
			}
		</style>
		<table  style="text-align: center" border="1" cellpadding="0">
			<colgroup>
				<col>
				<col>
				<col>
				<col>
				<col>
				<col>
				<col>
				<col>
				<col>
				<col>
			</colgroup>

          <tr>
			<th>Slot</th>
			<th>X</th>
			<th>Y</th>
			<th>Image</th>
			<th>X-M.</th>
			<th>Y-M.</th>
			<th>Rot.</th>
			<th>Pal.</th>
			<th>Pattern</th>
			<th>N6</th>
		  </tr>

%s

		</table>

		`;

		// Create a string with the table itself.
		let table = '';
		for(let k=0; k<64; k++) { // TODO: 128
			const sprite = this.sprites[k];
			if(!sprite)
				continue;
			const prevSprite = this.previousSprites[k];
			table += '<tr">\n'
			table += ' <td>' + k + '</td>\n'
			if(sprite.visible) {
				table += this.getTableTdWithBold(sprite.x, (prevSprite) ? prevSprite.x : -1);
				table += this.getTableTdWithBold(sprite.y, (prevSprite) ? prevSprite.y : -1);
				// Sprite image - convert to base64
				const buf = Buffer.from(sprite.image);
				const base64String = buf.toString('base64');
				table+= ' <td class="classPattern"><img class="classImg" src="data:image/gif;base64,' + base64String + '"></td>\n'
				// Attributes
				table += this.getTableTdWithBold(sprite.xMirrored, (prevSprite) ? prevSprite.xMirrored : -1);
				table += this.getTableTdWithBold(sprite.yMirrored, (prevSprite) ? prevSprite.yMirrored : -1);
				table += this.getTableTdWithBold(sprite.rotated, (prevSprite) ? prevSprite.rotated : -1);
				table += this.getTableTdWithBold(sprite.paletteOffset, (prevSprite) ? prevSprite.paletteOffset : -1);
				table+=this.getTableTdWithBold(sprite.patternIndex, (prevSprite)? prevSprite.patternIndex:-1);
				table+=this.getTableTdWithBold(sprite.N6, (prevSprite)? prevSprite.N6:-1);
			}
			else {
				// Invisible
				table += ' <td> - </td>\n <td> - </td>\n <td> - </td>\n <td> - </td>\n <td> - </td>\n <td> - </td>\n <td> - </td>\n <td> - </td>\n'
			}
			table += '</tr>\n\n';
		}

		const html = util.format(format, table);
		return html;
	}


	/**
	 * Creates one html canvas to display the sprites on the "screen".
	 * The screen also shows the border and the clipping rectangle.
	 * Additionally alls sprites are drawn into together with their slot index.
	 */
	protected createHtmlCanvas(): string {
		const format = `
		<canvas id="screen" width="640px" height="512px" style="border:1px solid #c3c3c3;">

		<script>
				function drawScreen() {
				var canvas = document.getElementById("screen");
				var ctx = canvas.getContext("2d");

				ctx.scale(2, 2);

				ctx.clearRect(0, 0, canvas.width, canvas.height);

				ctx.imageSmoothingEnabled = false;
				ctx.lineWidth=1;
				ctx.translate(0.5, 0.5);

				ctx.fillStyle = zxBorderColor;
				ctx.fillRect(0,0,320,256);
				ctx.fillStyle = zxScreenBckgColor;
				ctx.fillRect(32,32,320-2*32,256-2*32);

%s

				ctx.strokeStyle = zxScreenFgColor;
				ctx.fillStyle = zxScreenFgColor;

%s

			}
		</script>
`;

		// Html text for clipping
		let clipHtml = '';
		if(this.clippingEnabled) {
			clipHtml += 'ctx.beginPath();\n';
			clipHtml += 'ctx.strokeStyle = "red";\n';
			clipHtml += util.format('ctx.rect(%d,%d,%d,%d);\n', this.clipXl+32, this.clipYt+32, this.clipXr-this.clipXl+1, this.clipYb-this.clipYt+1);
			clipHtml += 'ctx.closePath();\n';
			clipHtml += 'ctx.stroke();\n\n';
		}

		// Create the sprites
		let spritesHtml = 'ctx.beginPath();\n';
		for(let k=0; k<64; k++) {
			const sprite = this.sprites[k];
			if(!sprite)
				continue;
			if(!sprite.visible)
				continue;
			// Surrounding rectangle
			spritesHtml += util.format("ctx.rect(%d,%d,%d,%d);\n", sprite.x, sprite.y, 16, 16);
			// The slot index
			spritesHtml += util.format('ctx.fillText("%d",%d,%d);\n', k, sprite.x+16+2, sprite.y+16);
			// The image
			const buf = Buffer.from(sprite.image);
			const base64String = buf.toString('base64');
			spritesHtml += util.format('var img%d = new Image();\n', k);
			spritesHtml += util.format('img%d.onload = function() { ctx.drawImage(img%d,%d,%d); };\n', k, k, sprite.x, sprite.y);
			spritesHtml += util.format('img%d.src = "data:image/gif;base64,%s";\n', k, base64String);
		}
		spritesHtml += 'ctx.closePath();\n';
		spritesHtml += 'ctx.stroke();\n\n';

		// Put everything together
		const html = util.format(format,
			clipHtml,
			spritesHtml,
			this.usedBckgColor);
		return html;
	}


	/**
	 * Sets the html code to display the sprites.
	 */
	protected setHtml() {
		if (!this.vscodePanel)
			return;

		const format = this.createHtmlSkeleton();
		// Add content
		const ui = this.createScriptsAndButtons();
		const table = this.createHtmlTable();
		const canvas = this.createHtmlCanvas();
		const content = ui + table + '\n<p style="margin-bottom:3em;"></p>\n\n' + canvas;
		const html = util.format(format, content);
		this.vscodePanel.webview.html = html;
	}

}

