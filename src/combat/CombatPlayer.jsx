import React, { Component } from "react";
import Api from '../api/api.js';
import Socket from '../socket/socket.js';
import { CombatScene } from "./CombatScene.jsx";
import { CombatHUD } from "../objects/CombatHUD.jsx";
import { PlayerSelections } from "../objects/PlayerSelections.jsx";
import { CombatAnalysis } from "./CombatAnalysis.jsx";

export class CombatPlayer extends CombatScene {
  constructor(props) {
    super(props);

    // Keep track of combat information
    this.combatApi     = props.combatApi;
    this.combatSocket  = props.combatSocket;
    this.battleId      = props.battleId;
    this.playback      = props.hasOwnProperty('playback') ? props.playback : true;
    this.teamId        = props.teamId;
    this.createOptions = props.createOptions;
    this.perks         = props.perks;

    this.nextTeam;
    this.nextUnit;

    // API for combat calls
    if (this.combatApi) {
      this.api = new Api(this.combatApi);
    } else if (this.combatSocket) {
      this.socket = new Socket(this.combatSocket, this.battleId);
      this.socket.setGetResponse(this.getCombatResponse.bind(this));
      this.socket.setOptionsResponse(this.getOptionsResponse.bind(this));
    }

    // Keep track of the UI
    this.userInterface = null;

    // Music
    this.combatMusic = null;

    // Player Selections
    this.playerSelections = new PlayerSelections(this.characters);

    // Keeping track of events that have been played,
    // current state, and events to play
    this.teams = null;

    // Keep track of events
    this.lastRenderedEventBlockUuid = null;
    this.eventBlocksIds = [];
    this.eventBlocks = [];
    this.battleComplete = false;

    // Keep track of clickable regions & ability to use them
    this.clickableRegions = {};
    this.clickLock = true;

    // Monitor changes to clickable regions
    window.addEventListener('registerClickableRegion', this.handleClickableRegion.bind(this));
    window.addEventListener('unregisterClickableRegion', this.handleRemoveClickableRegion.bind(this));
    window.addEventListener('lockClickableRegions', this.lockClickableRegions.bind(this));
    window.addEventListener('unlockClickableRegions', this.unlockClickableRegions.bind(this));
    window.addEventListener('eventBlockComplete', this.moveToNextEventBlock.bind(this));
  }

  componentDidMount() {
    super.componentDidMount(arguments);

    // Initialize with the background music
    if (this.soundManager.hasSound('music', 'aspire-combat-loop')) {
      this.combatMusic = this.soundManager.play('music', 'aspire-combat-loop', 0.15, true);
    }

    // Draw Game UI elements
    this.userInterface = new CombatHUD(
      this.renderer,
      this.soundManager,
      this.animationController.getActiveAnimationEventObject(),
      this.getUnitPosition.bind(this),
      this.confirmAction.bind(this)
    );

    // Update the HUD to use the player selection object
    this.userInterface.setPlayerSelectionsObject(this.playerSelections);

    // Pull the initial battle state
    if (this.battleId && this.battleId !== 'practice' && this.battleId !== 'test') {
      if (this.api) {
        this.getCombatApi();
      } else if (this.socket) {
        this.getCombatSocket();
      }
    } else if (this.battleId && (this.battleId === 'practice' || this.battleId === 'test')) {
      if (this.api) {
        this.createCombatApi();
      } else if (this.socket) {
        this.createCombatSocket();
      }
    }
  }

  componentDidUpdate() {
    if (super.hasOwnProperty('componentDidUpdate')) {
      super.componentDidUpdate(arguments);
    }

    console.log("Component Did Update call");

    if (!this.battleComplete) {
      if (this.playerSelections.hasSelections()) {
        this.unlockClickableRegions();
      }

      this.userInterface.registerTargetRegions();
      this.userInterface.invalidate();
    }
  }

  handleClickableRegion(e) {
    this.clickableRegions[e.detail.option] = e.detail.region;
  }

  handleRemoveClickableRegion(e) {
    if (this.clickableRegions.hasOwnProperty(e.detail.option)) {
      delete this.clickableRegions[e.detail.option];      
    }
  }

  clickableRegionsLocked() {
    return this.clickLock || this.battleComplete;
  }

  lockClickableRegions() {
    console.log("Clickable regions are locked");

    // Alert the HUD
    window.dispatchEvent(
      new CustomEvent("clickableRegionsLocked", {})
    );

    this.clickLock = true;
  }

  unlockClickableRegions(e) {
    if (e && e.detail && e.detail.event === 'BattleCompleteEvent' || this.battleComplete) {
      console.log("Battle completed, will not unlock clickable regions");
      return;
    }

    console.log("Clickable regions are unlocked");

    // Alert the HUD
    window.dispatchEvent(
      new CustomEvent("clickableRegionsUnlocked", {})
    );

    this.clickLock = false;
  }

  confirmAction() {
    // Pull the action and target
    let action = this.playerSelections.getAction();
    let target = this.playerSelections.getTarget();

    // If the action or target is invalid, disallow
    if (
      action === false || action === null
    ) {
      return;
    }

    if (target === null) {
      target = 'none';
    }

    // Lock the HUD
    this.lockClickableRegions();

    // Run combat
    if (this.api) {
      this.runCombatApi(action, target);
    } else if (this.socket) {
      this.runCombatSocket(action, target);
    }
  }

  getCombatApi() {
    if (!this.battleId) {
      console.log("No battle ID provided.")
      return;
    }

    this.api.getBattle({
        battleId: this.battleId
      },
      this.getCombatResponse.bind(this),
      this.handleErrorResponse.bind(this)
    );
  }

  createCombatApi() {
    if (!this.teamId) {
      console.log("No team ID provided.")
      return;
    }

    this.api.createBattle({
        teamId: this.teamId,
        createOptions: this.createOptions
      },
      this.getCombatResponse.bind(this),
      this.handleErrorResponse.bind(this)
    );
  }

  runCombatApi(action, target) {
    if (!this.battleId) {
      console.log("No battle ID provided.")
      return;
    }

    this.playerSelections.clear();

    this.api.runBattle({
        battleId: this.battleId,
        action:action,
        target:target
      },
      this.getCombatResponse.bind(this),
      this.handleErrorResponse.bind(this)
    );
  }

  getCombatSocket() {
    if (!this.battleId) {
      console.log("No battle ID provided.")
      return;
    }

    this.socket.get(this.battleId);
  }

  createCombatSocket() {
    if (!this.teamId) {
      console.log("No team ID provided.")
      return;
    }

    this.socket.create(this.teamId, this.createOptions);
  }

  runCombatSocket(action, target) {
    if (!this.battleId) {
      console.log("No battle ID provided.")
      return;
    }

    this.playerSelections.clear();

    this.socket.run(this.battleId, {action, target});
  }

  getCombatResponse(response) {
    // Verify the response is valid
    if (
      !response ||
      !response.data ||
      !response.data.hasOwnProperty('data') ||
      !response.data.hasOwnProperty('status') ||
      response.data.status !== 200
    ) {
      console.error("Could not retrieve battle information:");
      console.error(response.data);
      return;
    }

    // Pull the data out
    let data = response.data.data;

    if (data.error) {
      console.log("Error:", data.error);
      this.userInterface.setError(data.error);
    } else {
      this.userInterface.setError(null);
    }

    // Handle any preparation work if needed
    if (this.battleId != data.battleId) {
      console.warn("Setting new Battle ID (" + data.battleId + ") from previous (" + this.battleId + ")");

      // Update the battle ID
      this.battleId = data.battleId;

      // May need to listen to new channel
      if (this.socket) {
        this.socket.connectToChannel(this.battleId);
      }

      // Emit event for any front-end to capture data
      window.dispatchEvent(
        new CustomEvent("getBattleInformation", {
          'detail' : {
            'battleId' : data.battleId
          }
        })
      );

      // Pass off to the controller
      if (this.playback) {
        this.updateBattleEvents(data);
      } else {
        this.setLatestBattleEvents(data);
      }
    } else {
      // First load, so skip playback if requested
      if (!this.teams && !this.playback) {
        this.setLatestBattleEvents(data);
      } else {
        this.updateBattleEvents(data);
      }
    }
  }

  getOptionsResponse(response) {
    // Verify the response is valid
    if (
      !response ||
      !response.data ||
      !response.data.hasOwnProperty('data') ||
      !response.data.hasOwnProperty('status') ||
      response.data.status !== 200
    ) {
      console.error("Could not retrieve battle information:");
      console.error(response.data);
      return;
    }

    // Pull the data out
    let data = response.data.data;

    // Pass off to the controller
    this.playerSelections.clear();

    // Set the latest options for the player
    if (data.options && data.options.length) {
      this.playerSelections.setCards(data.options);
    }

    // If we received an error back but still have selections, unlock
    if (!this.battleComplete && this.playerSelections.hasSelections() && data.hasOwnProperty('error')) {
      this.unlockClickableRegions();
    }

    this.userInterface.invalidate();
  }

  handleErrorResponse(error) {
    console.error("error");
    console.error(error);
    this.playerSelections.clear();
    this.unlockClickableRegions();
  }

  updateBattleEvents(data) {
    // Set any initial information
    if (!this.teams && data.teams) {
      if (
        this.playback &&
        data.hasOwnProperty('events') && data.events && Array.isArray(data.events) &&
        data.events.length > 0 &&  data.events[0].hasOwnProperty('teams')
      ) {
        // If we're playing back, we need the team state at the first event we're playing back
        this.setTeams(data.events[0].teams);
      } else {
        // If we're not playing back, set the latest team data
        this.setTeams(data.teams);
      }
    } else if (data.teams) {
      this.updateTeams(data.teams);
    }

    // Set the latest options for the player
    if (data.options && data.options.length) {
      this.playerSelections.setCards(data.options);
    }

    this.nextTeam = data.nextTeam;
    this.nextUnit = data.nextUnit;

    // Determine if we have new events to render
    let hasNewEvents = false;
    if (data.hasOwnProperty('events')) {
      for (let _block of data.events) {
        if (this.eventBlocksIds.indexOf(_block.uuid) === -1) {
          // Add event blocks to the record
          this.eventBlocksIds.push(_block.uuid);
          this.eventBlocks.push(_block);
          hasNewEvents = true;
        }
      }
    }

    if (hasNewEvents) {
      this.renderEventBlocks();
    } else if (!this.battleComplete) {
      if (this.playerSelections.hasSelections()) {
        this.unlockClickableRegions();
      }
    }
  }

  setLatestBattleEvents(data) {
    // Set any initial information
    if (!this.teams && data.teams) {
      this.setTeams(data.teams);
    } else if (data.teams) {
      this.updateTeams(data.teams);
    }

    // Set the latest options for the player
    if (data.options && data.options.length) {
      this.playerSelections.setCards(data.options);
    }

    // Determine if we have new events to render
    let last_block_uuid;
    if (data.hasOwnProperty('events')) {
      for (let _block of data.events) {
        if (this.eventBlocksIds.indexOf(_block.uuid) === -1) {
          // Add event blocks to the record
          last_block_uuid = _block.uuid;
          this.eventBlocksIds.push(_block.uuid);
          this.eventBlocks.push(_block);
        }
      }
    }

    this.lastRenderedEventBlockUuid = last_block_uuid;
    this.renderEventBlocks();
    if (!this.battleComplete) {
      if (this.playerSelections.hasSelections()) {
        this.unlockClickableRegions();
      }
    }
  }

  setTeams(teams) {
    this.teams = teams;

    // Update all characters to include their UUIDs
    // Update all team members to link back to their character
    for (let _character of this.characters) {
      for (let _teamIdx of ["one", "two"]) {
        let _team = this.teams[_teamIdx];
        for (let _unitIdx in _team) {
          let _unit = _team[_unitIdx];
          if (_unit.metadata.nftId === _character.nftId) {
            // Set matching information
            _character.unitId = _unit.unitId;
            _character.unit = _unit;
            _unit.character = _character;

            // Pull in the head image
            this.loadHeadImage(_unit);
          }
        }
      }
    }

    this.userInterface.setTeams(this.teams);
  }

  getNftUrlRoot(_unit) {
    let urlRoot = "https://neon-district-season-one.s3.amazonaws.com/nfts/";
    if (
      _unit && typeof _unit === 'object' && _unit.hasOwnProperty('character') &&
      _unit.character.hasOwnProperty('nftId') && _unit.character.nftId.indexOf('ai-practice') === 0
    ) {
      return urlRoot + "ai-practice/";
    }

    if (
      window.location.href.indexOf('https://portal.neondistrict.io') === 0 ||
      window.location.href.indexOf('https://rc.portal.neondistrict.io') === 0
    ) {
      return urlRoot + "mainnet/";
    } else {
      return urlRoot + "testnet/";
    }
  }

  loadHeadImage(_unit) {
    /**
    This is not at all how I'd like to handle this, but the following does not work with S3:
      _unit.headImg = new Image();
      _unit.headImg.crossOrigin = "anonymous";

    Because sometimes, when caching is used, some images will not come back with the necessary origin headers,
    and the images aren't loaded.

    Furthermore, not setting crossOrigin breaks the canvas: "Tainted canvases may not be loaded."

    And setting use-credentials just breaks everything.

    So instead we need to force S3 to always return the origin header.
    **/

    /*
    // Old method
    _unit.headImg = new Image();
    _unit.headImg.crossOrigin = "anonymous";
    _unit.headImg.addEventListener('load', (function() {
      _unit.headImgLoaded = true;
    }).bind(this));
    _unit.headImg.addEventListener('error', (function() {
      console.error("Unable to load image for", _unit);
    }).bind(this));
    */

    const urlRoot = this.getNftUrlRoot(_unit);
    const src = urlRoot + _unit.metadata.nftId + '-headshot.png';
    _unit.headImgSrc = src;

    /*
    const options = {
      cache: 'no-cache',
      //mode: 'cors'
      //credentials: 'same-origin'
    };

    fetch(src, options)
      .then(res => res.blob())
      .then(blob => {
        _unit.headImg = new Image();
        _unit.headImg.crossOrigin = "anonymous";
        _unit.headImg.addEventListener('load', (function() {
          _unit.headImgLoaded = true;
        }).bind(this));
        _unit.headImg.src = URL.createObjectURL(blob);
    });
    */
  }

  updateTeams(teams) {
    for (let _teamIdx of ["one", "two"]) {
      for (let _unitIdx in this.teams[_teamIdx]) {
        let _unit = this.teams[_teamIdx][_unitIdx];

        if (teams && teams.hasOwnProperty(_teamIdx) && teams[_teamIdx].hasOwnProperty(_unitIdx)) {
          let _unitUpdate = teams[_teamIdx][_unitIdx];

          // Update all stats
          if (_unitUpdate.hasOwnProperty('ticks')) {
            _unit.ticks = _unitUpdate.ticks;
          }

          if (_unitUpdate.hasOwnProperty('lastTurnOrder')) {
            _unit.lastTurnOrder = _unitUpdate.lastTurnOrder;
          }

          if (_unitUpdate.hasOwnProperty('stats')) {
            for (let _prop in _unitUpdate.stats) {
              if (_prop !== 'HEALTH') {
                _unit.stats[_prop] = _unitUpdate.stats[_prop];
              }
            }
          }

          if (_unitUpdate.hasOwnProperty('state')) {
            _unit.state = _unitUpdate.state;
          }

          if (_unitUpdate.hasOwnProperty('statsMax')) {
            for (let _prop in _unitUpdate.statsMax) {
              _unit.statsMax[_prop] = _unitUpdate.statsMax[_prop];
            }
          }

          if (_unitUpdate.hasOwnProperty('statusEffects')) {
            for (let _prop in _unitUpdate.statusEffects) {
              _unit.statusEffects[_prop] = _unitUpdate.statusEffects[_prop];
            }
          }
        }
      }
    }

    this.userInterface.invalidate();
  }

  renderEventBlocks() {
    // Get the next block
    let nextIndex = 1 + this.eventBlocksIds.indexOf(this.lastRenderedEventBlockUuid);

    // If this block is beyond the last block, then we're done
    if (nextIndex >= this.eventBlocks.length) {
      this.postAnimationCleanup();
      return;
    }

    // Pull the block, register the animation events
    let block = this.eventBlocks[nextIndex];

    // Update the teams
    if (block.teams) {
      this.updateTeams(block.teams);
    }

    // If the battle is complete, we need to know this
    this.checkBattleComplete(block);

    // Perform the animation cycle
    this.runAnimationEventCycle(block);
  }

  moveToNextEventBlock() {
    // When we're done, update the last rendered event block, and render the next block
    if ((1 + this.eventBlocksIds.indexOf(this.lastRenderedEventBlockUuid)) < this.eventBlocks.length) {
      this.lastRenderedEventBlockUuid = this.eventBlocks[1 + this.eventBlocksIds.indexOf(this.lastRenderedEventBlockUuid)].uuid;
    }

    this.renderEventBlocks();
  }

  checkBattleComplete(block) {
    if ((block.battleEvents.filter((_evt) => _evt.name === 'BattleCompleteEvent')).length > 0) {

      let winner;
      for (let idx = 0; idx < block.battleEvents.length; idx++) {
        let event = block.battleEvents[idx];
        if (event.name === "BattleCompleteEvent") {
          winner = event.winner;
        }
      }

      // Alert the HUD
      window.dispatchEvent(
        new CustomEvent("battleComplete", {
          'detail' : {
            'winner' : winner
          }
        })
      );

      console.log("Battle is completed");
      this.battleComplete = true;

      // Play victory music
      this.combatMusic.stop();
      if (this.soundManager.hasSound('music', 'aspire-combat-loop')) {
        this.combatMusic = this.soundManager.play('music', 'aspire-combat-victory', 0.15, false);
      }
    }
  }

  postAnimationCleanup() {
    if (!this.battleComplete) {
        if (this.playerSelections.hasSelections() && CombatAnalysis.hasTaunt(this.nextUnit)) {
        let taunter = CombatAnalysis.getTaunter(this.nextUnit);

        // Make sure that the card selected is a valid choice
        if (this.playerSelections.validateTargetSelect(taunter)) {
          // Set the taunter as the default target
          this.playerSelections.setTarget(taunter);
          this.playerSelections.setTaunter(taunter);
        }
      }

      if (this.playerSelections.hasSelections()) {
        this.unlockClickableRegions();
      }
    }
  }

}
