import React, { Component } from "react";
import lstyle from "../../../styles/hud.scss";

export class PlayerControlsCard extends Component {

  isValidCard(card) {
    return card && card.type && ['attack','ability','effect','interact'].indexOf(card.type.toLowerCase()) >= 0;
  }

  render() {
    console.log("** Rendering the Player Controls Card **");

    let styles = [lstyle.card];
    let wrapperStyle = [lstyle.cardSelectionWrapper, this.props.selected ? lstyle.selected : ''].join(' ');

    let card = this.props.card;

    if (!this.isValidCard(card)) {
      // Get the specific card type for styles
      styles.push(lstyle.fillerCard);

      return (
        <div className={lstyle.cardSelectionWrapper}>
          <div className={styles.join(' ')}>
            <h3>Empty Card Slot</h3>
            <p>Missing Weapon Equipment</p>
          </div>
        </div>
      );
    }

    // Get the specific card type for styles
    styles.push(lstyle[card.type.toLowerCase() + 'Card']);

    return (
      <div className={wrapperStyle} onClick={this.props.callback}>
        <div className={styles.join(' ')}>
          <div className={lstyle.cardTopRow}>
            <div className={lstyle.cardTypeWrapper}>
              <span className={[lstyle.cardType, lstyle[card.type.toLowerCase() + 'CardType']].join(' ')}></span>
            </div>
            <h3 className={lstyle.cardTitle}>{card.name}</h3>
            <span className={lstyle.cardTicks}>
              <span className={lstyle.cardTicksNumber}>
                {card.tickCost}
              </span>
              <hr className={[lstyle.cardTicksLine, lstyle[card.type.toLowerCase() + 'Card']].join(' ')} />
              <span className={lstyle.cardTicksLabel}>Ticks</span>
            </span>
          </div>
          <p className={lstyle.cardEffects}>{card.effects}</p>
          <p className={lstyle.cardExploits}>{card.exploits}</p>
        </div>
      </div>
    );
  }

}