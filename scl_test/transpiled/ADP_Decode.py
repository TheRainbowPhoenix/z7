import math

def ADP_Decode_Size_and_Face(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   size_and_face: String
    #   decoded: ADP: Decoded: Size and Face
    #   encoded: ADP: Encoded: Formatting: Size and Face
    # VAR_TEMP:
    #   _return: String
    if (context['size_and_face'] == context['encoded'].bold_5):
        context['_return'] = context['decoded'].bold_5
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_11):
        context['_return'] = context['decoded'].bold_11
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_14):
        context['_return'] = context['decoded'].bold_14
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_15):
        context['_return'] = context['decoded'].bold_15
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_16):
        context['_return'] = context['decoded'].bold_16
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_22):
        context['_return'] = context['decoded'].bold_22
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_30):
        context['_return'] = context['decoded'].bold_30
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_32):
        context['_return'] = context['decoded'].bold_32
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].bold_40):
        context['_return'] = context['decoded'].bold_40
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_5):
        context['_return'] = context['decoded'].normal_5
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_7):
        context['_return'] = context['decoded'].normal_7
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_9):
        context['_return'] = context['decoded'].normal_9
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_11):
        context['_return'] = context['decoded'].normal_11
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_14):
        context['_return'] = context['decoded'].normal_14
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_15):
        context['_return'] = context['decoded'].normal_15
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_16):
        context['_return'] = context['decoded'].normal_16
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_22):
        context['_return'] = context['decoded'].normal_22
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_24):
        context['_return'] = context['decoded'].normal_24
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_30):
        context['_return'] = context['decoded'].normal_30
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_32):
        context['_return'] = context['decoded'].normal_32
        # GOTO RTRN (Not supported)
    if (context['size_and_face'] == context['encoded'].normal_40):
        context['_return'] = context['decoded'].normal_40
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Decode: Size and Face'] = context['_return']


def ADP_Decode_Horizontal_Alignment(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   horizontal_alignment: String
    #   decoded: ADP: Decoded: Horizontal Alignment
    #   encoded: ADP: Encoded: Formatting: Horizontal Alignment
    # VAR_TEMP:
    #   _return: String
    if (context['horizontal_alignment'] == context['encoded'].center):
        context['_return'] = context['decoded'].center
        # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['encoded'].left):
        context['_return'] = context['decoded'].left
        # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['encoded'].right):
        context['_return'] = context['decoded'].right
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Decode: Horizontal Alignment'] = context['_return']


def ADP_Decode_Scroll_Speed(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   scroll_speed: String
    #   decoded: ADP: Decoded: Scroll Speed
    #   encoded: ADP: Encoded: Formatting: Scroll Speed
    # VAR_TEMP:
    #   _return: String
    if (context['scroll_speed'] == context['encoded'].slowest):
        context['_return'] = context['decoded'].slowest
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['encoded'].slow):
        context['_return'] = context['decoded'].slow
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['encoded'].normal):
        context['_return'] = context['decoded'].normal
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['encoded'].fast):
        context['_return'] = context['decoded'].fast
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['encoded'].fastest):
        context['_return'] = context['decoded'].fastest
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Decode: Scroll Speed'] = context['_return']


def ADP_Decode_Flashing(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   flash: String
    #   decoded: ADP: Decoded: Flash
    #   encoded: ADP: Encoded: Formatting: Flashing
    # VAR_TEMP:
    #   _return: String
    if (context['flash'] == context['encoded'].off):
        context['_return'] = context['decoded'].off
        # GOTO RTRN (Not supported)
    if (context['flash'] == context['encoded'].on):
        context['_return'] = context['decoded'].on
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Decode: Flashing'] = context['_return']


def ADP_Decode_Vertical_Alignment(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   vertical_alignment: String
    #   decoded: ADP: Decoded: Vertical Alignment
    #   encoded: ADP: Encoded: Formatting: Vertical Alignment
    # VAR_TEMP:
    #   _return: String
    if (context['vertical_alignment'] == context['encoded'].bottom_hold):
        context['_return'] = context['decoded'].bottom_hold
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].fill_hold):
        context['_return'] = context['decoded'].fill_hold
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].middle_hold):
        context['_return'] = context['decoded'].middle_hold
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].top_hold):
        context['_return'] = context['decoded'].top_hold
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].bottom_scroll):
        context['_return'] = context['decoded'].bottom_scroll
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].fill_scroll):
        context['_return'] = context['decoded'].fill_scroll
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].middle_scroll):
        context['_return'] = context['decoded'].middle_scroll
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].top_scroll):
        context['_return'] = context['decoded'].top_scroll
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Decode: Vertical Alignment'] = context['_return']


def ADP_Decode_Color(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   color: String
    #   encoded: ADP: Encoded: Formatting: Color
    #   decoded: ADP: Decoded: Color
    # VAR_TEMP:
    #   _return: String
    if (context['color'] == context['encoded'].black):
        context['_return'] = context['decoded'].black
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].blue):
        context['_return'] = context['decoded'].blue
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].green):
        context['_return'] = context['decoded'].green
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].mix_1):
        context['_return'] = context['decoded'].mix_1
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].mix_2):
        context['_return'] = context['decoded'].mix_2
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].mix_3):
        context['_return'] = context['decoded'].mix_3
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].mix_4):
        context['_return'] = context['decoded'].mix_4
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].red):
        context['_return'] = context['decoded'].red
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].white):
        context['_return'] = context['decoded'].white
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].yellow):
        context['_return'] = context['decoded'].yellow
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Decode: Color'] = context['_return']


def ADP_Decode(context, global_dbs):
    # Return Type: ADP: Message Formats: Encoded
    # VAR_INPUT:
    #   codes: ADP: Message Formats: Encoded
    #   adp_decoded: ADP: Decoded
    #   adp_encoded: ADP: Encoded: Formatting
    # VAR_TEMP:
    #   _ret: ADP: Message Formats: Encoded
    context['_ret'].color = ADP:_Decode:_Color(color=context['codes'].color, encoded=context['adp_encoded'].color, decoded=context['adp_decoded'].color)
    context['_ret'].flash = ADP:_Decode:_Flashing(flash=context['codes'].flash, decoded=context['adp_decoded'].flash, encoded=context['adp_encoded'].flashing)
    context['_ret'].horizontal_alignment = ADP:_Decode:_Horizontal_Alignment(horizontal_alignment=context['codes'].horizontal_alignment, decoded=context['adp_decoded'].horizontal_alignment, encoded=context['adp_encoded'].horizontal_alignment)
    context['_ret'].scroll_speed = ADP:_Decode:_Scroll_Speed(scroll_speed=context['codes'].scroll_speed, decoded=context['adp_decoded'].scroll_speed, encoded=context['adp_encoded'].scroll_speed)
    context['_ret'].size_and_face = ADP:_Decode:_Size_and_Face(size_and_face=context['codes'].size_and_face, decoded=context['adp_decoded'].size_and_face, encoded=context['adp_encoded'].size_and_face)
    context['_ret'].vertical_alignment = ADP:_Decode:_Vertical_Alignment(vertical_alignment=context['codes'].vertical_alignment, decoded=context['adp_decoded'].vertical_alignment, encoded=context['adp_encoded'].vertical_alignment)
    context['ADP: Decode'] = context['_ret']
