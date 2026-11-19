import os,sys,json,tempfile,subprocess,time,ctypes,ctypes.util
from pathlib import Path
import gi
gi.require_version('Atspi','2.0')
from gi.repository import Atspi
root=Path.cwd()
executable=(Path(sys.argv[1]) if len(sys.argv)>1 else root/'src-tauri/target/debug/gitjournal-desktop').resolve()
with tempfile.TemporaryDirectory(prefix='gitjournal-gui-') as tmp:
 d=Path(tmp);repo=d/"repo é & '";repo.mkdir()
 def git(*args):return subprocess.check_output(['git','-C',str(repo),*args],stderr=subprocess.PIPE)
 git('init','-q','-b','main')
 git('remote','add','origin','https://github.com/example/gui-fixture.git')
 git('-c','core.hooksPath='+str(repo),'-c','commit.gpgsign=false','-c','user.name=Test','-c','user.email=test@example.invalid','commit','--allow-empty','-m','Tâche vérifiée [30m done]\nDescription <script>data</script>')
 p={'projectName':'Essai Fedora','me':'Test','journalStartDate':None,'exceptions':[],'columns':[{'label':'Date','source':'date','format':'date','field':'date'},{'label':'Tâche','source':'name','field':'name'},{'label':'Description','source':'description','field':'description'},{'label':'Durée','source':'duration','format':'duration','field':'duration'},{'label':'Statut','source':'status','field':'status'}]}
 project=repo/'essai.gitj';project.write_text(json.dumps(p))
 env={**os.environ,'XDG_CONFIG_HOME':str(d/'config'),'XDG_DATA_HOME':str(d/'data'),'GDK_BACKEND':'x11','GTK_MODULES':'gail:atk-bridge'}
 proc=subprocess.Popen([str(executable),project.as_uri()],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 def app():
  desktop=Atspi.get_desktop(0)
  for i in range(desktop.get_child_count()):
   child=desktop.get_child_at_index(i)
   try:
    if child.get_process_id()==proc.pid:return child
   except Exception:pass
 def walk(n,depth=0):
  if n is None:return
  yield n
  if depth<18:
   for i in range(n.get_child_count()):
    try:yield from walk(n.get_child_at_index(i),depth+1)
    except Exception:pass
 def wait_for(check):
  deadline=time.time()+10
  while time.time()<deadline:
   value=check()
   if value:return value
   time.sleep(.15)
  raise AssertionError('Résultat attendu absent')
 try:
  deadline=time.time()+30
  while time.time()<deadline:
   if proc.poll() is not None:raise RuntimeError(proc.stderr.read())
   a=app()
   names=[n.get_name() for n in walk(a)]
   if any('Essai Fedora' in name for name in names) and '+ Ajouter une entrée' in names:break
   time.sleep(.3)
  else:raise RuntimeError('Interface non trouvée : '+repr(names))
  print('Journal Git rendu dans la webview Tauri.')
  assert any(n.get_role_name()=='link' and n.get_name()=='Voir le commit sur GitHub' for n in walk(a))
  bar=next(n for n in walk(a) if n.get_role_name()=='menu bar')
  assert [bar.get_child_at_index(i).get_name() for i in range(bar.get_child_count())]==[
   'Fichier','Édition','Affichage','Configuration','Statistiques','Aide']
  assert not any(n.get_name()=='Afficher les actions' for n in walk(a))
  def menu(*path):
   root=next(n for n in walk(app()) if n.get_role_name()=='menu bar')
   for label in path:
    root=next(root.get_child_at_index(i) for i in range(root.get_child_count())
              if root.get_child_at_index(i).get_name()==label)
    assert root.get_action_iface().do_action(0),label
    time.sleep(.25)
  print('Ordre de la barre native vérifié.')
  for n in walk(a):
   if n.get_name()=='+ Ajouter une entrée':n.get_action_iface().do_action(0);break
  time.sleep(.4)
  def find(role,name):
   return next((n for n in walk(app()) if n.get_role_name()==role and n.get_name()==name),None)
  def click(name):
   target=wait_for(lambda:find('button',name));assert target.get_action_iface().do_action(0);time.sleep(.25)
  xdo=ctypes.CDLL(ctypes.util.find_library('xdo'))
  xdo.xdo_new.restype=ctypes.c_void_p;xdo.xdo_new.argtypes=[ctypes.c_char_p]
  xd=xdo.xdo_new(None)
  for function in [xdo.xdo_enter_text_window,xdo.xdo_send_keysequence_window]:
   function.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.c_char_p,ctypes.c_uint]
  window=next(line.split()[0] for line in subprocess.check_output(['wmctrl','-lp'],text=True).splitlines() if len(line.split())>2 and line.split()[2]==str(proc.pid))
  subprocess.run(['wmctrl','-ia',window],check=True);time.sleep(.3)
  def is_fullscreen():
   return '_NET_WM_STATE_FULLSCREEN' in subprocess.check_output(['xprop','-id',window,'_NET_WM_STATE'],text=True)
  assert not is_fullscreen()
  xdo.xdo_send_keysequence_window(xd,0,b'F11',12000)
  wait_for(is_fullscreen)
  xdo.xdo_send_keysequence_window(xd,0,b'F11',12000)
  wait_for(lambda:not is_fullscreen())
  print('Entrée et sortie du plein écran vérifiées.')
  xdo.xdo_move_mouse.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int]
  xdo.xdo_click_window.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.c_int]
  def type_text(text,select=True):
   if select:xdo.xdo_send_keysequence_window(xd,int(window,16),b'ctrl+a',12000)
   xdo.xdo_enter_text_window(xd,int(window,16),text.encode(),12000)
  def set_field(name,text):
   target=wait_for(lambda:find('entry',name))
   assert Atspi.Component.grab_focus(target)
   time.sleep(.1);type_text(text)
   wait_for(lambda:Atspi.Text.get_text(target,0,-1).lower()==text.lower())
  def select_field(name,index):
   target=wait_for(lambda:find('combo box',name))
   Atspi.Component.scroll_to(target,Atspi.ScrollType.ANYWHERE);time.sleep(.2)
   rect=Atspi.Component.get_extents(target,Atspi.CoordType.SCREEN)
   xdo.xdo_move_mouse(xd,rect.x+rect.width//2,rect.y+rect.height//2,0);xdo.xdo_click_window(xd,0,1);time.sleep(.1)
   options=[n for n in walk(target) if n.get_role_name()=='menu item']
   assert options[index].get_action_iface().do_action(0)
   time.sleep(.2)
  set_field('Tâche','Manual <script>data</script>')
  set_field('Description','Description test')
  set_field('Durée (min)','30')
  click('Enregistrer')
  assert not json.loads(project.read_text())['exceptions'], 'Statut obligatoire'
  select_field('Préfixe de la tâche (facultatif)',1)
  target=wait_for(lambda:find('radio button','Done'));assert target.get_action_iface().do_action(0)
  wait_for(lambda:target.get_state_set().contains(Atspi.StateType.CHECKED))
  click('Enregistrer')
  wait_for(lambda:len(json.loads(project.read_text())['exceptions'])==1)
  saved=json.loads(project.read_text())['exceptions'][0]
  assert saved['duration']==30 and saved['name'].lower()=='feat: manual <script>data</script>' and saved['status']=='Done'
  print('Ajout depuis le formulaire et sauvegarde automatique validés.')
  wait_for(lambda:find('button','Modifier'))
  edits=[n for n in walk(app()) if n.get_role_name()=='button' and n.get_name()=='Modifier']
  edits[0].get_action_iface().do_action(0)
  set_field('Durée (min)','45')
  target=wait_for(lambda:find('radio button','WIP'));assert target.get_action_iface().do_action(0)
  wait_for(lambda:target.get_state_set().contains(Atspi.StateType.CHECKED))
  click('Enregistrer')
  wait_for(lambda:json.loads(project.read_text())['exceptions'][0]['duration']==45)
  assert json.loads(project.read_text())['exceptions'][0]['status']=='WIP'
  assert json.loads(project.read_text())['exceptions'][0]['date']==saved['date']
  print('Modification et persistance validées.')
  for label in ['Mode système','Mode sombre','Mode clair','Mode sombre']:
   menu('Affichage','Thème',label)
   wait_for(lambda:any(Atspi.Text.get_text(n,0,-1)==label
                       for n in walk(app()) if n.get_role_name()=='status bar' and n.get_text_iface()))
  print('Trois modes sélectionnés depuis le sous-menu Thème.')
  menu('Affichage','Actualiser')
  menu('Fichier','Enregistrer')
  menu('Configuration','Structure JSON');click('Annuler')
  menu('Configuration','Token','GitHub');click('Enregistrer')
  preferences=d/'config'/'com.gitjournal.desktop'/'settings.json'
  wait_for(lambda:preferences.exists() and json.loads(preferences.read_text()).get('githubToken')=='')
  menu('Statistiques');wait_for(lambda:find('button','Annuler'))
  def accessible_label(n):
   try:return n.get_name() or Atspi.Text.get_text(n,0,-1)
   except Exception:return ''
  names=[accessible_label(n) for n in walk(app())]
  assert any('Durée par jour' in name for name in names)
  assert any('Répartition des statuts' in name for name in names)
  click('Annuler')
  menu('Aide');wait_for(lambda:find('button','Annuler'));click('Annuler')
  print('Préférences, statistiques et aide ouvertes et fermées.')
  def native_dialog(title):
   candidate=app()
   if candidate:
    for j in range(candidate.get_child_count()):
     window=candidate.get_child_at_index(j)
     if title in window.get_name():return window
  menu('Configuration','Structure Export')
  select_field('Source',1)
  select_field('Séparateur',1)
  select_field('Orientation A4',1)
  for label in ['Date','Inclure les statistiques des entrées exportées','Afficher le titre du projet',
                'Ajouter une colonne de liens vers les sources','Inclure la marque UTF-8 (BOM)']:
   target=wait_for(lambda:find('check box',label))
   assert target.get_action_iface().do_action(0),label
  click('Enregistrer')
  wait_for(lambda:json.loads(project.read_text()).get('exportOptions',{}).get('source')=='commit')
  options=json.loads(project.read_text())['exportOptions']
  assert options['statistics'] and options['sourceLinks'] and not options['heading'] and not options['bom']
  assert options['separator']==';' and options['orientation']=='portrait'
  print('Structure Export enregistrée dans le projet.')
  for label,extension in [('CSV','csv'),('PDF','pdf'),('Markdown','md')]:
   menu('Fichier','Exporter','En '+label)
   native=wait_for(lambda:native_dialog('Exporter le journal en '+label))
   save=next(n for n in walk(native) if n.get_role_name()=='button' and n.get_name() in ['Save','Enregistrer'])
   assert save.get_action_iface().do_action(0)
   output=repo/('journal.'+extension)
   wait_for(lambda:output.exists() and output.stat().st_size>0)
   if extension=='csv':
    data=output.read_bytes()
    assert data.startswith('Tâche;Description;Durée;Statut'.encode())
    assert 'Statistiques'.encode() in data and b'Done' in data and b'WIP' in data
    assert b'manual' not in data.lower() and b'\r\n' in data
   elif extension=='pdf':
    assert output.read_bytes().startswith(b'%PDF-')
    info=subprocess.check_output(['pdfinfo',str(output)],text=True)
    size=next(line.split() for line in info.splitlines() if line.startswith('Page size:'))
    assert float(size[2]) < float(size[4]),info
    text=subprocess.check_output(['pdftotext','-enc','UTF-8',str(output),'-'],text=True,encoding='utf-8')
    assert 'Tâche vérifiée' in text and 'Total de la sélection' in text and 'Statistiques' in text
    assert 'manual' not in text.lower()
   else:
    text=output.read_text(encoding='utf-8')
    assert text.startswith('| Tâche | Description | Durée | Statut | Lien source |')
    assert 'Tâche vérifiée' in text and 'Total de la sélection' in text and 'Statistiques' in text
    assert '[Voir la source](https://github.com/example/gui-fixture/commit/' in text
    assert 'manual' not in text.lower()
   print(label+' créé depuis la fenêtre Tauri et contenu vérifié.')
   time.sleep(.3)
  menu('Fichier','Imprimer')
  native=wait_for(lambda:native_dialog('Print') or native_dialog('Imprimer'))
  cancel=next(n for n in walk(native) if n.get_role_name()=='button' and n.get_name() in ['Cancel','Annuler'])
  assert cancel.get_action_iface().do_action(0)
  print('Dialogue d’impression système vérifié et annulé sans impression physique.')
  time.sleep(.3)
  def pointer_click(name):
   target=wait_for(lambda:find('button',name))
   Atspi.Component.scroll_to(target,Atspi.ScrollType.ANYWHERE);time.sleep(.2)
   rect=Atspi.Component.get_extents(target,Atspi.CoordType.SCREEN)
   xdo.xdo_move_mouse(xd,rect.x+rect.width//2,rect.y+rect.height//2,0);xdo.xdo_click_window(xd,0,1)
  edits=[n for n in walk(app()) if n.get_role_name()=='button' and n.get_name()=='Modifier']
  edits[0].get_action_iface().do_action(0)
  pointer_click('Supprimer l’entrée manuelle');click('Confirmer')
  wait_for(lambda:not json.loads(project.read_text())['exceptions'])
  click('Modifier');pointer_click('Exclure le commit');click('Confirmer')
  wait_for(lambda:any(e.get('excluded') for e in json.loads(project.read_text())['exceptions']))
  print('Suppression manuelle et exclusion validées depuis les formulaires.')
  proc.terminate();proc.wait(timeout=5)
  proc=subprocess.Popen([str(executable)],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  wait_for(lambda:any('Essai Fedora' in n.get_name() for n in walk(app())))
  print('Dernier projet restauré au redémarrage, sans argument de fichier.')
  window=next(line.split()[0] for line in subprocess.check_output(['wmctrl','-lp'],text=True).splitlines() if len(line.split())>2 and line.split()[2]==str(proc.pid))
  subprocess.run(['wmctrl','-ia',window],check=True)
  menu('Fichier','Nouveau projet')
  set_field('Nom du projet','Nouveau test')
  set_field('Auteur(s) Git (virgule ou point-virgule)','Test')
  set_field('URL du dépôt Git (facultative)','https://gitlab.com/example/gui-fixture.git')
  click('Enregistrer')
  native=wait_for(lambda:native_dialog('Projet GitJournal'))
  def accessible_text(n):
   try:
    if not n.get_state_set().contains(Atspi.StateType.EDITABLE):return ''
    return Atspi.Text.get_text(n,0,-1)
   except Exception:return ''
  filename=next(n for n in walk(native) if accessible_text(n)=='projet.gitj')
  rect=Atspi.Component.get_extents(filename,Atspi.CoordType.SCREEN)
  xdo.xdo_move_mouse(xd,rect.x+rect.width//2,rect.y+rect.height//2,0);xdo.xdo_click_window(xd,0,1)
  new_project=repo/'nouveau.gitj';Atspi.EditableText.set_text_contents(filename,str(new_project))
  save=next(n for n in walk(native) if n.get_role_name()=='button' and n.get_name() in ['Save','Enregistrer']);save.get_action_iface().do_action(0)
  wait_for(lambda:new_project.exists());assert json.loads(new_project.read_text())['projectName'].lower()=='nouveau test'
  assert json.loads(new_project.read_text())['repoUrl']=='https://gitlab.com/example/gui-fixture'
  wait_for(lambda:any(n.get_name()=='Voir le commit sur GitLab' for n in walk(app())))
  print('Création du projet et lien GitLab pour le commit local validés.')
  time.sleep(.3);menu('Fichier','Ouvrir un projet')
  native=wait_for(lambda:native_dialog('Projet GitJournal'))
  item=wait_for(lambda:next((n for n in walk(native) if n.get_name()=='essai.gitj'),None))
  rect=Atspi.Component.get_extents(item,Atspi.CoordType.SCREEN)
  xdo.xdo_move_mouse(xd,rect.x+rect.width//2,rect.y+rect.height//2,0);xdo.xdo_click_window(xd,0,1)
  opening=next(n for n in walk(native) if n.get_role_name()=='button' and n.get_name() in ['Open','Ouvrir']);opening.get_action_iface().do_action(0)
  wait_for(lambda:json.loads(preferences.read_text()).get('lastOpenedFile')==str(project))
  print('Ouverture d’un projet existant via le dialogue natif validée.')


  xdo.xdo_free.argtypes=[ctypes.c_void_p];xdo.xdo_free(xd)



 finally:
  proc.terminate()
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:proc.kill();proc.wait()
  stderr=proc.stderr.read()
  if stderr:print(stderr[-3000:])
